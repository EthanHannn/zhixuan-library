import "server-only";

import { prisma } from "@/lib/prisma";
import { MIN_BOOK_SCORE } from "@/lib/catalog";
import {
  COVER_ERROR_SOURCES,
  COVER_NOT_FOUND_SOURCE,
  queueBookCoverFetch,
  type QueueResult,
} from "@/lib/cover-fetcher";

interface CoverBackfillState {
  started: boolean;
  running: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  attempts: number;
  lastBookId: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: QueueResult | "idle" | "error" | null;
}

const globalForCoverBackfill = globalThis as typeof globalThis & {
  zhixuanCoverBackfill?: CoverBackfillState;
};

const state = globalForCoverBackfill.zhixuanCoverBackfill || {
  started: false,
  running: false,
  timer: null,
  attempts: 0,
  lastBookId: null,
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: null,
};

globalForCoverBackfill.zhixuanCoverBackfill = state;

const DEFAULT_INTERVAL_SECONDS = 90;
const DEFAULT_INITIAL_DELAY_SECONDS = 30;
const EMPTY_RETRY_MS = 6 * 60 * 60 * 1000;
const BLOCKED_RETRY_MS = 15 * 60 * 1000;
const NOT_FOUND_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const ERROR_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function configuredSeconds(name: string, fallback: number, minimum: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function isEnabled() {
  const configured = process.env.COVER_AUTO_FETCH?.trim().toLowerCase();
  if (configured) return !["0", "false", "off", "no"].includes(configured);
  return process.env.NODE_ENV === "production";
}

const intervalMs = configuredSeconds("COVER_AUTO_FETCH_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS, 30) * 1000;
const initialDelayMs = configuredSeconds("COVER_AUTO_FETCH_INITIAL_DELAY_SECONDS", DEFAULT_INITIAL_DELAY_SECONDS, 5) * 1000;

function intervalWithJitter() {
  return Math.round(intervalMs * (0.8 + Math.random() * 0.4));
}

async function findNextCandidate() {
  const now = Date.now();

  return prisma.book.findFirst({
    where: {
      status: "APPROVED",
      hasContent: true,
      score: { gte: MIN_BOOK_SCORE },
      AND: [
        {
          OR: [
            { coverPath: null },
            { coverPath: { endsWith: ".svg" } },
          ],
        },
        {
          OR: [
            { coverFetchedAt: null },
            { coverSource: null },
            // Retry legacy Douban-only failures immediately now that more sources exist.
            { coverSource: { in: ["douban:not_found", "douban:error", "douban:rate_limited"] } },
            {
              coverSource: COVER_NOT_FOUND_SOURCE,
              coverFetchedAt: { lte: new Date(now - NOT_FOUND_COOLDOWN_MS) },
            },
            {
              coverSource: { in: [...COVER_ERROR_SOURCES] },
              coverFetchedAt: { lte: new Date(now - ERROR_COOLDOWN_MS) },
            },
          ],
        },
      ],
    },
    orderBy: [
      { xiancaoCount: "desc" },
      { score: "desc" },
      { id: "asc" },
    ],
    select: { id: true },
  });
}

function scheduleNext(delayMs: number) {
  state.nextRunAt = new Date(Date.now() + delayMs).toISOString();
  state.timer = setTimeout(runCycle, delayMs);
  state.timer.unref?.();
}

async function runCycle() {
  if (state.running) return;

  state.running = true;
  state.timer = null;
  state.nextRunAt = null;
  state.lastRunAt = new Date().toISOString();
  let nextDelay = intervalWithJitter();

  try {
    const candidate = await findNextCandidate();
    if (!candidate) {
      state.lastBookId = null;
      state.lastStatus = "idle";
      nextDelay = EMPTY_RETRY_MS;
      return;
    }

    state.lastBookId = candidate.id;
    const request = queueBookCoverFetch(candidate.id);
    state.lastStatus = request.status;

    if (request.status === "blocked") {
      nextDelay = BLOCKED_RETRY_MS;
      return;
    }

    if (request.completion) {
      await request.completion;
      state.attempts += 1;
    }
  } catch (error) {
    state.lastStatus = "error";
    console.warn("[cover-scheduler] 自动补全任务失败:", error);
  } finally {
    state.running = false;
    scheduleNext(nextDelay);
  }
}

export function getCoverBackfillStatus() {
  return {
    enabled: isEnabled(),
    started: state.started,
    running: state.running,
    attempts: state.attempts,
    lastBookId: state.lastBookId,
    lastRunAt: state.lastRunAt,
    nextRunAt: state.nextRunAt,
    lastStatus: state.lastStatus,
    intervalSeconds: Math.round(intervalMs / 1000),
  };
}

export function startCoverBackfillScheduler() {
  if (!isEnabled() || state.started) return getCoverBackfillStatus();

  state.started = true;
  scheduleNext(initialDelayMs);
  console.info(`[cover-scheduler] 已启动，约每 ${Math.round(intervalMs / 1000)} 秒处理一本待补封面的作品。`);
  return getCoverBackfillStatus();
}
