import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

const noStoreHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  pragma: "no-cache",
  expires: "0"
};

function withNoStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers ?? {});
  Object.entries(noStoreHeaders).forEach(([key, value]) => headers.set(key, value));
  return {
    ...init,
    headers
  };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 200, ...withNoStore(init) });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 201, ...withNoStore() });
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ ok: false, error: { message, details } }, { status: 400, ...withNoStore() });
}

export function forbidden(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status: 403, ...withNoStore() });
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status: 404, ...withNoStore() });
}

export function serverError(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status: 500, ...withNoStore() });
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<{ data: T } | { error: NextResponse }> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { error: badRequest("Invalid JSON body.") };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return { error: badRequest("Validation failed.", result.error.flatten()) };
  }

  return { data: result.data };
}
