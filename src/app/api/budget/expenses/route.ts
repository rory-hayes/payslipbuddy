import { NextResponse } from "next/server";

function deferred() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message: "Budget board is deferred to V1.5."
      }
    },
    { status: 501 }
  );
}

export async function GET() {
  return deferred();
}

export async function POST() {
  return deferred();
}
