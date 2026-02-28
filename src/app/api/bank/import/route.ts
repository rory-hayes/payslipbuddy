import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message: "Bank CSV import is deferred to V1.5."
      }
    },
    { status: 501 }
  );
}
