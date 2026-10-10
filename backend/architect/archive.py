import io
import stat
import zipfile
from pathlib import Path, PurePosixPath

from .scanner import DENIED_DIRS, ScanError, hard_excluded

MAX_UPLOAD = 3 * 1024 * 1024
MAX_EXPANDED = 20 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 3000


def unpack(data: bytes, destination: Path) -> tuple[Path, list[dict]]:
    if len(data) > MAX_UPLOAD:
        raise ScanError("ZIP exceeds 3 MiB. Remove dependencies and generated files first.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise ScanError("ZIP exceeds 3,000 entries. Upload a smaller repository.")
            if sum(entry.file_size for entry in entries) > MAX_EXPANDED:
                raise ScanError("ZIP expands beyond 20 MiB. Upload a smaller repository.")
            seen = set()
            skipped = []
            for entry in entries:
                name = entry.filename
                path = PurePosixPath(name)
                mode = entry.external_attr >> 16
                if (not path.parts or path.is_absolute() or ".." in path.parts
                        or "\\" in name or ":" in name or "\0" in name
                        or path.as_posix() in seen or len(path.parts) > 50):
                    raise ScanError("ZIP contains an unsafe or duplicate file path.")
                seen.add(path.as_posix())
                if stat.S_ISLNK(mode) or entry.flag_bits & 1:
                    raise ScanError("Symbolic links and encrypted ZIPs are not supported.")
                if any(part in DENIED_DIRS or part == "__MACOSX" for part in path.parts):
                    skipped.append({"path": name, "reason": "Excluded generated or credential directory"})
                    continue
                target = destination.joinpath(*path.parts)
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    # Keep excluded files out of temporary storage, including known credentials.
                    if hard_excluded(path.name):
                        skipped.append({"path": name, "reason": "Excluded credential or lock file"})
                        continue
                    if entry.file_size > 1024 * 1024:
                        skipped.append({"path": name, "reason": "File exceeds 1 MiB"})
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(entry))
    except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError, ValueError):
        raise ScanError("This ZIP could not be read. Export a standard repository ZIP and retry.") from None
    children = list(destination.iterdir())
    root = children[0] if len(children) == 1 and children[0].is_dir() else destination
    return root, skipped
