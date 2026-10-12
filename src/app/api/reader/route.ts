import { NextResponse } from "next/server";
import { getCurrentReader, rejectUnauthorizedRequest } from "@/lib/auth";

export async function GET() {
  const denied = await rejectUnauthorizedRequest();
  if (denied) return denied;
  const reader = await getCurrentReader();
  return NextResponse.json(reader || { error: "默认读者未初始化" }, { status: reader ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
