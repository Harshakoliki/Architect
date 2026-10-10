"""Static evidence extraction. Never imports or executes the analyzed repository."""
import ast
import hashlib
import json
import posixpath
from pathlib import PurePosixPath

import tree_sitter_javascript
import tree_sitter_typescript
from tree_sitter import Language, Parser

from .scanner import redact

VERSION = "static-graph-0.2"
EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".py")


def identifier(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:24]


def build_graph(files: list[dict]) -> dict:
    by_path = {file["path"]: file for file in files}
    nodes = {}
    edges = []
    edge_ids = set()
    gaps = []
    requests = []
    routes = []
    parsed = 0
    roots = {""}
    configs = []
    next_roots = []
    for file in files:
        if PurePosixPath(file["path"]).name in {"pyproject.toml", "requirements.txt"}:
            root = posixpath.dirname(file["path"])
            roots.update({root, posixpath.join(root, "src")})
        if PurePosixPath(file["path"]).name in {"tsconfig.json", "jsconfig.json"}:
            try:
                options = json.loads(file["content"]).get("compilerOptions", {})
                if isinstance(options, dict) and isinstance(options.get("paths", {}), dict):
                    configs.append((posixpath.dirname(file["path"]), options))
            except (ValueError, AttributeError):
                gaps.append({"message": "Alias configuration is not plain JSON; aliases may remain unresolved",
                             "file_id": file["id"], "path": file["path"], "start_line": 1})
        if PurePosixPath(file["path"]).name == "package.json":
            try:
                manifest = json.loads(file["content"])
                if "next" in {**manifest.get("dependencies", {}), **manifest.get("devDependencies", {})}:
                    next_roots.append(posixpath.dirname(file["path"]))
            except (ValueError, TypeError, AttributeError):
                pass
    configs.sort(key=lambda config: len(config[0]), reverse=True)

    def file_node(file):
        nodes[file["id"]] = {"id": file["id"], "kind": "file", "label": file["path"],
                              "file_id": file["id"], "language": file["language"]}
        return file["id"]

    def evidence(file, start, end, method):
        return {"file_id": file["id"], "path": file["path"], "start_line": start,
                "end_line": min(end, file["lines"]), "extractor": method,
                "source_hash": file["hash"]}

    def link(source, target, kind, proof, confidence="observed"):
        edge_id = identifier(f"{source}:{target}:{kind}:{proof[0]['start_line']}")
        if edge_id in edge_ids:
            return
        edge_ids.add(edge_id)
        edges.append({"id": edge_id,
                      "source": source, "target": target, "kind": kind,
                      "confidence": confidence, "evidence": proof})

    def resolve(base):
        base = posixpath.normpath(base)
        candidates = [base, *(base + suffix for suffix in EXTENSIONS),
                      *(posixpath.join(base, "index" + suffix) for suffix in EXTENSIONS),
                      posixpath.join(base, "__init__.py")]
        return next((by_path[path] for path in candidates if path in by_path), None)

    def imported(file, module, proof, python_level=None, names=()):
        target = None
        local = False
        if python_level is not None:
            if python_level:
                parent = PurePosixPath(file["path"]).parent
                for _ in range(python_level - 1):
                    parent = parent.parent
                base = posixpath.join(str(parent), module.replace(".", "/"))
                target = resolve(base)
                if not target and not module:
                    matches = [resolve(posixpath.join(base, name)) for name in names]
                    matches = [match for match in matches if match]
                    if matches:
                        for match in matches:
                            link(file_node(file), file_node(match), "imports", [proof])
                        return
                local = True
            else:
                matches = {match["id"]: match for root in roots
                           if (match := resolve(posixpath.join(root, module.replace(".", "/"))))}
                if len(matches) == 1:
                    target = next(iter(matches.values()))
                elif len(matches) > 1:
                    local = True
        elif module.startswith("."):
            target = resolve(posixpath.join(posixpath.dirname(file["path"]), module))
            local = True
        else:
            for base, options in configs:
                if base and not file["path"].startswith(base + "/"):
                    continue
                for pattern, mappings in options.get("paths", {}).items():
                    if pattern.count("*") > 1 or not isinstance(mappings, list):
                        continue
                    prefix, star, suffix = pattern.partition("*")
                    if (not star and module != pattern) or (star and not (
                        module.startswith(prefix) and module.endswith(suffix)
                        and len(module) >= len(prefix) + len(suffix)
                    )):
                        continue
                    local = True
                    middle = module[len(prefix):len(module)-len(suffix) if suffix else None] if star else ""
                    base_url = options.get("baseUrl", ".")
                    if not isinstance(base_url, str):
                        break
                    for mapping in mappings:
                        if not isinstance(mapping, str):
                            continue
                        target = resolve(posixpath.join(base, base_url, mapping.replace("*", middle)))
                        if target:
                            break
                    break
                # Only the nearest configuration applies; extends/JSONC are not expanded.
                break
            if module.startswith(("@/", "~/")):
                local = True
        if target:
            link(file_node(file), file_node(target), "imports", [proof])
        else:
            kind = "unresolved" if local else "reference"
            node_id = identifier(f"{kind}:{file['id'] if local else ''}:{module}")
            nodes[node_id] = {"id": node_id, "kind": kind, "label": module or "Relative import",
                              "description": "Unresolved local import" if local else "External or unresolved module reference"}
            link(file_node(file), node_id, "unresolved" if local else "references", [proof],
                 "unknown" if local else "observed")
            if local:
                gaps.append({"message": f"Cannot resolve {module or 'relative import'}", **proof})

    def route(file, method, path, proof):
        node_id = identifier(f"route:{file['id']}:{method}:{path}:{proof['start_line']}")
        nodes[node_id] = {"id": node_id, "kind": "route", "label": f"{method} {path}",
                          "file_id": file["id"], "line": proof["start_line"],
                          "description": "Declared route; mounted prefixes may differ"}
        link(node_id, file_node(file), "implemented_by", [proof])
        routes.append((method, path, node_id, proof))

    for file in files:
        suffix = PurePosixPath(file["path"]).suffix.lower()
        if suffix not in {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
            continue
        file_node(file)
        if suffix == ".py":
            try:
                tree = ast.parse(file["content"])
            except (SyntaxError, ValueError, RecursionError):
                gaps.append({"message": "Python syntax could not be parsed", "file_id": file["id"],
                             "path": file["path"], "start_line": 1})
                continue
            parsed += 1
            factories = set()
            for node in ast.walk(tree):
                proof = evidence(file, getattr(node, "lineno", 1), getattr(node, "end_lineno", 1), "python-ast")
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imported(file, alias.name, proof, python_level=0)
                elif isinstance(node, ast.ImportFrom):
                    imported(file, node.module or "", proof, python_level=node.level,
                             names=[alias.name for alias in node.names])
                    if node.module == "fastapi":
                        factories.update(alias.asname or alias.name for alias in node.names
                                         if alias.name in {"FastAPI", "APIRouter"})
            apps = {target.id for node in tree.body if isinstance(node, ast.Assign)
                    and isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name)
                    and node.value.func.id in factories for target in node.targets
                    if isinstance(target, ast.Name)}
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                for decorator in node.decorator_list:
                    if (isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute)
                            and isinstance(decorator.func.value, ast.Name)
                            and decorator.func.value.id in apps
                            and decorator.func.attr in {"get", "post", "put", "patch", "delete", "head", "options"}
                            and decorator.args and isinstance(decorator.args[0], ast.Constant)
                            and isinstance(decorator.args[0].value, str)):
                        route(file, decorator.func.attr.upper(), decorator.args[0].value,
                              evidence(file, decorator.lineno, decorator.end_lineno, "fastapi-decorator"))
            continue
        language = (tree_sitter_typescript.language_tsx() if suffix == ".tsx" else
                    tree_sitter_typescript.language_typescript() if suffix == ".ts" else
                    tree_sitter_javascript.language())
        tree = Parser(Language(language)).parse(file["content"].encode())
        if tree.root_node.has_error:
            gaps.append({"message": "JS/TS syntax could not be fully parsed; relationships omitted",
                         "file_id": file["id"], "path": file["path"], "start_line": 1})
            continue
        parsed += 1
        next_path = None
        for next_root in sorted(next_roots, key=len, reverse=True):
            for app_root in (posixpath.join(next_root, "app"), posixpath.join(next_root, "src/app")):
                if file["path"].startswith(app_root + "/"):
                    relative = file["path"][len(app_root) + 1:]
                    segments = PurePosixPath(relative).parts[:-1]
                    next_path = "/" + "/".join(part for part in segments
                                                if not (part.startswith("(") and part.endswith(")")))
                    break
            if next_path is not None:
                break
        if (next_path is not None and PurePosixPath(file["path"]).stem == "page"
                and any(node.type == "export_statement" and node.text.startswith(b"export default")
                        for node in tree.root_node.named_children)):
            route(file, "PAGE", next_path, evidence(file, 1, 1, "next-app-file-convention"))

        def literal(node):
            if node is None or node.type != "string":
                return None
            value = node.text.decode()[1:-1]
            return value if "\\" not in value else None

        stack = [tree.root_node]
        while stack:
            node = stack.pop()
            stack.extend(reversed(node.named_children))
            proof = evidence(file, node.start_point.row + 1, node.end_point.row + 1, "tree-sitter")
            if (next_path is not None and PurePosixPath(file["path"]).stem == "route"
                    and node.type == "function_declaration" and node.parent.type == "export_statement"):
                name = node.child_by_field_name("name")
                if name and name.text.decode() in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}:
                    route(file, name.text.decode(), next_path, proof)
            if node.type in {"import_statement", "export_statement"}:
                source = literal(node.child_by_field_name("source"))
                if source is not None:
                    imported(file, source, proof)
            if node.type == "call_expression":
                function = node.child_by_field_name("function")
                arguments = node.child_by_field_name("arguments")
                if function is None or arguments is None:
                    continue
                args = arguments.named_children
                name = function.text.decode()
                if name in {"require", "import"}:
                    source = literal(args[0]) if args else None
                    if source is None:
                        gaps.append({"message": "Computed module import: target unknown", **proof})
                    else:
                        imported(file, source, proof)
                if name == "fetch" and args:
                    path = literal(args[0])
                    if path is None or not path.startswith("/") or path.startswith("//"):
                        gaps.append({"message": "HTTP request target outside supported literal local paths", **proof})
                        continue
                    method = "GET"
                    if len(args) > 1:
                        if args[1].type != "object":
                            method = None
                        else:
                            for pair in args[1].named_children:
                                if pair.type == "spread_element" or (
                                    pair.type.startswith("shorthand_property") and pair.text == b"method"
                                ):
                                    method = None
                                    break
                                if pair.type != "pair":
                                    continue
                                key = pair.child_by_field_name("key")
                                if key and key.text.decode().strip("\"'") == "method":
                                    method = literal(pair.child_by_field_name("value"))
                    requests.append((file, method.upper() if method else None,
                                     path.split("?")[0].split("#")[0], proof))

    for file, method, path, proof in requests:
        matches = [(node_id, route_proof) for verb, declared, node_id, route_proof in routes
                   if method == verb and path == declared]
        if len(matches) == 1:
            target, route_proof = matches[0]
            link(file_node(file), target, "http_candidate", [proof, route_proof], "inferred")
        else:
            gaps.append({"message": f"No unique route match for {method or 'unknown method'} {path}", **proof})

    for node in nodes.values():
        node["label"] = redact(node["label"])
    for gap in gaps:
        gap["message"] = redact(gap["message"])
    return {"nodes": list(nodes.values()), "edges": edges, "gaps": gaps,
            "analyzer_version": VERSION, "parsed_files": parsed,
            "coverage": "Static Python and JS/TS imports, plain-JSON path aliases, FastAPI decorators, Next.js App Router file conventions/exported handler functions, and literal fetch-to-route candidates. No runtime tracing, symbol call graph, mounted prefixes, inherited alias config, or deployment topology."}
