import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ ok: false, error: { message, details } }, { status: 400 });
}

export function forbidden(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status: 403 });
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status: 404 });
}

export function serverError(message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
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
