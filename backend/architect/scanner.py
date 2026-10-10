import hashlib
import json
import os
import re
import stat
import tomllib
from collections import Counter
from pathlib import Path

from pathspec import GitIgnoreSpec

LANGUAGES = {
    ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript",
    ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".css": "CSS",
    ".scss": "CSS", ".html": "HTML", ".json": "JSON", ".md": "Markdown",
    ".sql": "SQL", ".toml": "TOML", ".yaml": "YAML", ".yml": "YAML",
    ".go": "Go", ".rs": "Rust", ".java": "Java", ".txt": "Text",
}
DENIED_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", ".next", "dist", "build",
    "coverage", ".architect-data", ".pytest_cache", ".ruff_cache", ".cache",
    ".ssh", ".aws", ".gnupg", ".kube", ".config", ".local", ".npm",
}
LOCKFILES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock", "uv.lock", "poetry.lock"}
MAX_FILE_BYTES = 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
MAX_FILES = 10_000
MAX_ENTRIES = 50_000


class ScanError(Exception):
    pass


def hard_excluded(name: str) -> bool:
    lower = name.lower()
    return (lower.startswith((".env", "id_rsa", "id_ed25519", "id_ecdsa")) or lower in LOCKFILES
            or lower in {"credentials", "credentials.json", "secrets.json", ".npmrc", ".pypirc"}
            or lower.endswith((".pem", ".key", ".p12", ".pfx", ".crt")))


def read_safe(root: Path, relative: str) -> bytes:
    # Walk with directory descriptors so symlink replacement cannot redirect a read.
    parts = Path(relative).parts
    if not parts or Path(relative).is_absolute() or ".." in parts:
        raise ScanError("Invalid source location.")
    descriptors = []
    try:
        descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        descriptors.append(descriptor)
        for part in parts[:-1]:
            descriptor = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                 dir_fd=descriptor)
            descriptors.append(descriptor)
        source = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                         dir_fd=descriptor)
        with os.fdopen(source, "rb") as stream:
            before = os.fstat(stream.fileno())
            if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_FILE_BYTES:
                raise ScanError("File is not a regular source file or exceeds the size limit.")
            data = stream.read(MAX_FILE_BYTES + 1)
            after = os.fstat(stream.fileno())
            if len(data) > MAX_FILE_BYTES:
                raise ScanError("File exceeds the size limit.")
            if (before.st_mtime_ns, before.st_size) != (after.st_mtime_ns, after.st_size):
                raise ScanError("File changed during scanning. Scan again after saving.")
            return data
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def discover(root: Path, skipped, cancelled=lambda: False):
    entries_seen = 0

    def walk(directory: Path, specs: list, depth: int):
        nonlocal entries_seen
        if cancelled():
            raise InterruptedError
        if depth > 50:
            skipped(directory.relative_to(root).as_posix(), "Directory depth limit")
            return
        ignore = directory / ".gitignore"
        if ignore.exists():
            try:
                content = read_safe(root, ignore.relative_to(root).as_posix()).decode("utf-8")
                specs = [*specs, (directory, GitIgnoreSpec.from_lines(content.splitlines()))]
            except (OSError, UnicodeError, ScanError):
                # Do not silently scan files when an ignore policy cannot be read.
                raise ScanError("A .gitignore policy could not be read. Fix it before scanning.") from None
        try:
            with os.scandir(directory) as listing:
                entries = sorted(listing, key=lambda entry: entry.name)
        except OSError:
            raise ScanError("A project folder became unreadable. Check permissions and retry.") from None
        for entry in entries:
            entries_seen += 1
            if entries_seen > MAX_ENTRIES:
                raise ScanError("This project exceeds 50,000 entries. Choose a smaller project folder.")
            path = Path(entry.path)
            rel = path.relative_to(root).as_posix()
            if entry.is_symlink():
                skipped(rel, "Symbolic link")
                continue
            is_dir = entry.is_dir(follow_symlinks=False)
            if (is_dir and entry.name in DENIED_DIRS) or hard_excluded(entry.name):
                skipped(rel, "Excluded for privacy or generated content")
                continue
            excluded = None
            for base, spec in specs:
                match = spec.check_file(path.relative_to(base).as_posix() + ("/" if is_dir else ""))
                if match.include is not None:
                    excluded = match.include
            if excluded:
                skipped(rel, "Git ignore rule")
                continue
            if is_dir:
                yield from walk(path, specs, depth + 1)
            elif entry.is_file(follow_symlinks=False):
                if entry.name == ".gitignore":
                    continue
                if path.suffix.lower() not in LANGUAGES:
                    skipped(rel, "Unsupported file type")
                elif entry.stat(follow_symlinks=False).st_size > MAX_FILE_BYTES:
                    skipped(rel, "File exceeds 1 MiB")
                else:
                    yield rel
            else:
                skipped(rel, "Not a regular file")
    yield from walk(root, [], 0)


def detect_frameworks(files: list[dict]) -> list[str]:
    found = set()
    for file in files:
        try:
            if file["path"].endswith("package.json"):
                manifest = json.loads(file["content"])
                names = set(manifest.get("dependencies", {})) | set(manifest.get("devDependencies", {}))
                found.update(label for name, label in {"next": "Next.js", "react": "React",
                             "express": "Express", "@prisma/client": "Prisma"}.items() if name in names)
            elif file["path"].endswith("pyproject.toml"):
                manifest = tomllib.loads(file["content"])
                dependencies = manifest.get("project", {}).get("dependencies", [])
                if any(re.match(r"fastapi(?:\b|\[)", dependency, re.IGNORECASE) for dependency in dependencies):
                    found.add("FastAPI")
            elif file["path"].endswith("requirements.txt"):
                if re.search(r"^fastapi(?:\b|\[)", file["content"], re.MULTILINE | re.IGNORECASE):
                    found.add("FastAPI")
        except (ValueError, TypeError, AttributeError):
            continue
    return sorted(found)


def scan(root: Path, progress=lambda *args: None, cancelled=lambda: False):
    skips = []
    reasons = Counter()

    def skipped(path, reason):
        reasons[reason] += 1
        if len(skips) < 200:
            skips.append({"path": path, "reason": reason})

    progress("discovering", 0, None)
    paths = list(discover(root, skipped, cancelled))
    if len(paths) > MAX_FILES:
        raise ScanError("This project exceeds 10,000 source files. Choose a smaller project folder.")
    files = []
    size = 0
    for index, relative in enumerate(paths):
        if cancelled():
            raise InterruptedError
        try:
            raw = read_safe(root, relative)
            if b"\0" in raw:
                skipped(relative, "Binary content")
                continue
            content = raw.decode("utf-8")
        except (OSError, UnicodeError, ScanError):
            skipped(relative, "Unreadable, changed, or non-UTF-8 file")
            continue
        size += len(raw)
        if size > MAX_TOTAL_BYTES:
            raise ScanError("Source exceeds 100 MiB. Choose a smaller project folder.")
        files.append({"id": hashlib.sha256(relative.encode()).hexdigest()[:24],
                      "path": relative, "language": LANGUAGES[Path(relative).suffix.lower()],
                      "size": len(raw), "lines": len(content.splitlines()),
                      "hash": hashlib.sha256(raw).hexdigest(), "content": content})
        if index % 20 == 0 or index + 1 == len(paths):
            progress("capturing", index + 1, len(paths))
    summary = {"file_count": len(files), "total_bytes": size,
               "line_count": sum(file["lines"] for file in files),
               "languages": dict(Counter(file["language"] for file in files)),
               "frameworks": detect_frameworks(files), "skipped_count": sum(reasons.values()),
               "skip_reasons": dict(reasons), "skipped": skips,
               "skipped_truncated": sum(reasons.values()) > len(skips),
               "coverage": "File inventory only. Dependency and flow analysis starts in Phase 2.",
               "analyzer_version": "inventory-0.1"}
    return files, summary


def redact(content: str) -> str:
    content = re.sub(r"-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----",
                     lambda m: "\n".join("[REDACTED]" for _ in m[0].splitlines()),
                     content, flags=re.DOTALL)
    content = re.sub(r"\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|AKIA[A-Z0-9]{16})\b",
                     "[REDACTED]", content)
    return re.sub(r"(?i)((?:password|secret|api[_-]?key|access[_-]?token)[\"']?\s*[:=]\s*)"
                  r"([\"'])([^\n]*?)\2", r"\1\2[REDACTED]\2", content)
