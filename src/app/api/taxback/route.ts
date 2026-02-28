import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message: "Numeric TaxBack estimates are deferred to V1.5."
      }
    },
    { status: 501 }
  );
}
