import gzip
import json
import os

import httpx


def configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SECRET_KEY"))


def client():
    key = os.environ["SUPABASE_SECRET_KEY"]
    headers = {"apikey": key}
    if key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {key}"
    return httpx.Client(base_url=os.environ["SUPABASE_URL"].rstrip("/"),
                        headers=headers, timeout=25)


def save(workspace: str, project: dict, contents: dict):
    key = f"{workspace}/{project['id']}.json.gz"
    with client() as connection:
        response = connection.post(f"/storage/v1/object/architect-source/{key}",
                                   content=gzip.compress(json.dumps(contents).encode()),
                                   headers={"Content-Type": "application/gzip"})
        response.raise_for_status()
        try:
            response = connection.post("/rest/v1/architect_scans", json={
                "id": project["id"], "workspace_id": workspace, "name": project["name"],
                "summary": project["summary"], "files": project["files"], "source_key": key,
                "graph": project.get("graph", {}),
            })
            response.raise_for_status()
        except httpx.HTTPError:
            connection.delete(f"/storage/v1/object/architect-source/{key}")
            raise


def projects(workspace: str):
    with client() as connection:
        response = connection.get("/rest/v1/architect_scans", params={
            "workspace_id": f"eq.{workspace}", "select": "id,name,summary,created_at",
            "order": "created_at.desc", "limit": "30",
        })
        response.raise_for_status()
        return response.json()


def load(workspace: str, project_id: str):
    with client() as connection:
        response = connection.get("/rest/v1/architect_scans", params={
            "workspace_id": f"eq.{workspace}", "id": f"eq.{project_id}", "limit": "1",
        })
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        row = rows[0]
        response = connection.get(f"/storage/v1/object/architect-source/{row['source_key']}")
        response.raise_for_status()
        row["contents"] = json.loads(gzip.decompress(response.content))
        row.pop("workspace_id", None)
        row.pop("source_key", None)
        row["persisted"] = True
        return row


def delete(workspace: str, project_id: str):
    filters = {"workspace_id": f"eq.{workspace}", "id": f"eq.{project_id}"}
    key = f"{workspace}/{project_id}.json.gz"
    with client() as connection:
        response = connection.get("/rest/v1/architect_scans", params={
            **filters, "select": "source_key", "limit": "1",
        })
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return False
        if rows[0]["source_key"] != key:
            raise ValueError("Unexpected source location")
        # Remove source first; a failed metadata delete can safely retry this exact key.
        response = connection.request("DELETE", "/storage/v1/object/architect-source",
                                      json={"prefixes": [key]})
        response.raise_for_status()
        response = connection.delete("/rest/v1/architect_scans", params=filters)
        response.raise_for_status()
        return True
