import { NextRequest, NextResponse } from "next/server";
import { gatewayFailure } from "@/lib/gateway-policy";

export function proxy(request: NextRequest) {
  // The container-local health probe is exempt here; nginx protects its public URL.
  if (request.nextUrl.pathname === "/api/health" && ["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const failure = gatewayFailure(request.headers, request.method);
  if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  if (request.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.json({ error: "原书屋登录接口已停用" }, { status: 410 });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/:path*"] };
