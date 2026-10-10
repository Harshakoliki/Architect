import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  if (!/^(health|projects(?:\/[a-f0-9-]{36})?|sample|scan)$/.test(endpoint)) {
    return NextResponse.json({ detail: "Unknown endpoint." }, { status: 404 });
  }
  const cookieStore = await cookies();
  const existing = cookieStore.get("architect-workspace")?.value;
  const workspace = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString("hex");
  const secret = process.env.ARCHITECT_SERVICE_SECRET;
  const backend = process.env.ARCHITECT_BACKEND_URL || "http://127.0.0.1:8000";
  if (!secret) return NextResponse.json({ detail: "Set ARCHITECT_SERVICE_SECRET on both servers." }, { status: 503 });
  const headers = new Headers({ "x-architect-secret": secret, "x-architect-workspace": workspace });
  for (const name of ["content-type", "x-project-name"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    let body: ArrayBuffer | undefined;
    if (request.method === "POST") {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = request.body?.getReader();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 3 * 1024 * 1024) {
            await reader.cancel();
            return NextResponse.json({ detail: "ZIP exceeds 3 MiB." }, { status: 413 });
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = bytes.buffer;
    }
    const upstream = await fetch(`${backend}/api/${endpoint}`, {
      method: request.method, headers, body, cache: "no-store", signal: request.signal,
    });
    const response = new NextResponse(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } });
    if (existing !== workspace) response.cookies.set("architect-workspace", workspace, {
      httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.json({ detail: "The analysis server is unavailable. Check that both services are running." }, { status: 503 });
  }
}

export { proxy as GET, proxy as POST };
