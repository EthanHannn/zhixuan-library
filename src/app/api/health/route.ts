import { NextResponse } from "next/server";
import { startCoverBackfillScheduler } from "@/lib/cover-scheduler";

export const dynamic = "force-dynamic";

export function GET() {
  const coverBackfill = startCoverBackfillScheduler();

  return NextResponse.json(
    { status: "ok", coverBackfill },
    { headers: { "Cache-Control": "no-store" } },
  );
}

