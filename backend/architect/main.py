import hmac
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import UUID, uuid4

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from . import db
from .analyzer import build_graph
from .archive import MAX_UPLOAD, unpack
from .product import (
    InterpretationRequest,
    annotated_example,
    interpret,
    make_context,
    validate_context,
)
from .questions import QuestionRequest, answer_question
from .scanner import ScanError, redact, scan

app = FastAPI(title="Architect", version="0.6.0")
SAMPLE = Path(__file__).parent.parent / "fixtures" / "document-app"


@app.middleware("http")
async def server_boundary(request: Request, call_next):
    secret = os.getenv("ARCHITECT_SERVICE_SECRET", "")
    if not secret or not hmac.compare_digest(request.headers.get("x-architect-secret", ""), secret):
        return JSONResponse({"detail": "Access through the Architect web app."}, status_code=403)
    workspace = request.headers.get("x-architect-workspace", "")
    if not re.fullmatch(r"[a-f0-9]{64}", workspace):
        return JSONResponse({"detail": "Open a workspace in the web app first."}, status_code=403)
    request.state.workspace = workspace
    return await call_next(request)


@app.get("/api/health")
def health():
    return {"storage": "supabase" if db.configured() else "preview", "phase": 6,
            "ai_configured": bool(os.getenv("OPENAI_API_KEY")),
            "ai_model": os.getenv("OPENAI_MODEL") or "gpt-6.1-sol"}


@app.get("/api/projects")
def list_projects(request: Request):
    if not db.configured():
        return []
    try:
        return db.projects(request.state.workspace)
    except httpx.HTTPError:
        raise HTTPException(503, "Saved projects are unavailable. Check Supabase setup.") from None


@app.get("/api/projects/{project_id}")
def get_project(project_id: UUID, request: Request):
    if not db.configured():
        raise HTTPException(404, "Preview scans exist only in this browser session.")
    try:
        result = db.load(request.state.workspace, str(project_id))
    except (httpx.HTTPError, ValueError, OSError):
        raise HTTPException(503, "This saved scan could not be loaded.") from None
    if result is None:
        raise HTTPException(404, "Scan not found in this workspace.")
    result["ai_context"] = make_context(result["files"], result["contents"], result.get("graph", {}))
    return result


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: UUID, request: Request):
    if not db.configured():
        raise HTTPException(404, "No saved scans in preview mode.")
    try:
        deleted = db.delete(request.state.workspace, str(project_id))
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "Deletion did not finish. Source may already be removed; retry to finish deleting the scan.") from None
    if not deleted:
        raise HTTPException(404, "Scan not found in this workspace.")
    return {"deleted": str(project_id)}


def events(data: bytes | None, name: str, workspace: str, sample_root: Path = SAMPLE):
    def event(value):
        return json.dumps(value) + "\n"

    try:
        yield event({"stage": "Scanning source files"})
        with TemporaryDirectory(prefix="architect-") as directory:
            root, excluded = unpack(data, Path(directory)) if data is not None else (sample_root, [])
            files, summary = scan(root)
            for entry in excluded:
                reason = entry["reason"]
                summary["skip_reasons"][reason] = summary["skip_reasons"].get(reason, 0) + 1
            summary["skipped_count"] += len(excluded)
            summary["skipped"] = (summary["skipped"] + excluded)[:200]
            summary["skipped_truncated"] = summary["skipped_count"] > 200
        if not files:
            raise ScanError("No supported source files found. Check the ZIP contents and ignore rules.")
        yield event({"stage": "Parsing imports and declared routes"})
        graph = build_graph(files)
        summary["coverage"] = graph["coverage"]
        contents = {file["id"]: redact(file.pop("content")) for file in files}
        context = make_context(files, contents, graph)
        project = {"id": str(uuid4()), "name": name, "files": files, "summary": summary,
                   "created_at": datetime.now(UTC).isoformat(), "persisted": False, "graph": graph}
        if db.configured():
            yield event({"stage": "Saving scan to your Supabase project"})
            try:
                db.save(workspace, project, contents)
                project["persisted"] = True
            except httpx.HTTPError:
                project["warning"] = "Scan complete, but saving failed. This is a temporary preview. Check Supabase setup."
        project["contents"] = contents
        project["ai_context"] = context
        project["sample"] = data is None and sample_root == SAMPLE
        yield event({"stage": "complete", "project": project})
    except ScanError as error:
        yield event({"stage": "error", "message": str(error)})


@app.post("/api/sample")
def sample(request: Request):
    return StreamingResponse(events(None, "document-app · sample", request.state.workspace),
                             media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})


@app.post("/api/sample-next")
def sample_next(request: Request):
    return StreamingResponse(events(None, "document-app · updated sample", request.state.workspace,
                                    SAMPLE.parent / "document-app-v2"),
                             media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})


@app.post("/api/scan")
async def upload(request: Request):
    if request.headers.get("content-type", "").split(";")[0] != "application/zip":
        raise HTTPException(415, "Upload a ZIP archive.")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_UPLOAD:
            raise HTTPException(413, "ZIP exceeds 3 MiB. Remove generated files first.")
    from urllib.parse import unquote

    name = re.sub(r"[^\w .-]", "", unquote(request.headers.get("x-project-name", "repository")))[:80]
    return StreamingResponse(events(bytes(data), name or "repository", request.state.workspace),
                             media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})


def product_result(body: InterpretationRequest):
    context = validate_context(body.context)
    if body.example:
        files, _ = scan(SAMPLE)
        graph = build_graph(files)
        expected = make_context(files, {file["id"]: redact(file["content"]) for file in files}, graph)
        return annotated_example(context, expected)
    if not body.consent:
        raise ValueError("Confirm sending the listed source excerpts to OpenAI before continuing.")
    return interpret(context)


@app.post("/api/interpret")
async def product_interpretation(request: Request):
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 64_000:
            raise HTTPException(413, "Interpretation context exceeds 64 KB.")
    try:
        body = InterpretationRequest.model_validate_json(data)
    except ValidationError:
        raise HTTPException(422, "Invalid interpretation request. Reopen the source scan.") from None
    try:
        return await run_in_threadpool(product_result, body)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None


@app.post("/api/ask")
async def ask(request: Request):
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 128_000:
            raise HTTPException(413, "Question context exceeds 128 KB.")
    try:
        body = QuestionRequest.model_validate_json(data)
    except ValidationError:
        raise HTTPException(422, "Invalid question request. Reopen the source scan.") from None
    def result():
        context = validate_context(body.context)
        expected = product_result(InterpretationRequest(context=body.context, example=True)) if body.example else None
        return answer_question(body, context, expected)
    try:
        return await run_in_threadpool(result)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
