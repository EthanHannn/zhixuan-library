import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";
import { prisma } from "./prisma";
import { gatewayConfig, gatewayFailure } from "./gateway-policy";
import type { ReaderContext } from "./reader-types";

export async function rejectUnauthorizedRequest(method = "GET") {
  const failure = gatewayFailure(await headers(), method);
  return failure ? NextResponse.json({ error: failure.error }, { status: failure.status, headers: { "Cache-Control": "no-store" } }) : null;
}

// Per-request/render deduplication; never cache an identity across requests.
export const getCurrentReader = cache(async (): Promise<ReaderContext | null> => {
  if (gatewayFailure(await headers(), "GET")) return null;
  const config = gatewayConfig()!;
  const user = await prisma.user.findUnique({
    where: { id: "default-reader" },
    select: { id: true, username: true, nickname: true, role: true },
  });
  if (!user) return null;
  return { user: { ...user, nickname: user.nickname || user.username }, logoutUrl: `${config.authOrigin}/logout` };
});
