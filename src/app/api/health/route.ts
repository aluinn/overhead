import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/health — liveness probe (no upstream calls). */
export function GET() {
  return NextResponse.json(
    { status: "ok", time: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
