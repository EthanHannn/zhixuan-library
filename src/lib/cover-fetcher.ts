import "server-only";

import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MIN_BOOK_SCORE } from "@/lib/catalog";
import {
  findDoubanCover,
  findQidianCover,
  findQqCover,
  type CoverCandidate,
  type CoverSourceName,
} from "@/lib/cover-sources";
import { prisma } from "@/lib/prisma";

interface CoverQueueState {
  chain: Promise<void>;
  queued: Set<number>;
  completions: Map<number, Promise<void>>;
  nextRequestAt: number;
  sourceBlockedUntil: Partial<Record<CoverSourceName, number>>;
}

export type QueueResult = "queued" | "duplicate" | "busy" | "blocked";

interface CoverFetchRequest {
  status: QueueResult;
  completion: Promise<void> | null;
}

interface CoverBook {
  id: number;
  title: string;
  author: string;
}

const globalForCoverQueue = globalThis as typeof globalThis & {
  zhixuanCoverQueue?: CoverQueueState;
};

const queueState = globalForCoverQueue.zhixuanCoverQueue || {
  chain: Promise.resolve(),
  queued: new Set<number>(),
  completions: new Map<number, Promise<void>>(),
  nextRequestAt: 0,
  sourceBlockedUntil: {},
};

// Keep Fast Refresh compatible with queue state created before these fields existed.
queueState.completions ||= new Map<number, Promise<void>>();
queueState.sourceBlockedUntil ||= {};

globalForCoverQueue.zhixuanCoverQueue = queueState;

const coverRoot = process.env.COVER_ROOT
  ? path.resolve(process.env.COVER_ROOT)
  : path.join(process.cwd(), "public", "covers");
const realCoverRoot = path.join(coverRoot, "real");
const userAgent = process.env.COVER_FETCH_USER_AGENT || "zhixuan-library-cover-fetcher/1.0 (private-library; sequential requests)";
const MAX_PENDING_BOOKS = 20;
const NOT_FOUND_COOLDOWN = 30 * 24 * 60 * 60 * 1000;
const ERROR_COOLDOWN = 24 * 60 * 60 * 1000;
const RATE_LIMIT_COOLDOWN = 6 * 60 * 60 * 1000;
const COVER_SOURCES: CoverSourceName[] = ["qidian", "qq", "douban"];

export const COVER_NOT_FOUND_SOURCE = "covers:not_found";
export const COVER_ERROR_SOURCES = ["covers:error", "covers:rate_limited"] as const;

class CoverRateLimitError extends Error {
  constructor(
    readonly source: CoverSourceName,
    status: number,
  ) {
    super(`${source} 暂时限制访问：HTTP ${status}`);
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hasRealCover(coverPath: string | null) {
  return Boolean(coverPath && !coverPath.toLowerCase().endsWith(".svg"));
}

async function realCoverExists(coverPath: string | null) {
  if (!hasRealCover(coverPath) || !coverPath?.startsWith("/covers/")) return false;
  const absoluteCoverRoot = path.resolve(coverRoot);
  const absolutePath = path.resolve(absoluteCoverRoot, coverPath.slice("/covers/".length));
  if (!absolutePath.startsWith(`${absoluteCoverRoot}${path.sep}`)) return false;
  try {
    return (await stat(absolutePath)).isFile();
  } catch {
    return false;
  }
}

function cooldownFor(source: string | null) {
  if (source === COVER_NOT_FOUND_SOURCE) return NOT_FOUND_COOLDOWN;
  if (COVER_ERROR_SOURCES.some((value) => value === source)) return ERROR_COOLDOWN;
  return 0;
}

async function waitForRequestSlot() {
  const wait = Math.max(0, queueState.nextRequestAt - Date.now());
  if (wait > 0) await sleep(wait);
  queueState.nextRequestAt = Date.now() + 5_000 + Math.round(Math.random() * 3_000);
}

async function fetchWithTimeout(source: CoverSourceName, url: string, headers: Record<string, string> = {}) {
  await waitForRequestSlot();
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json,image/*;q=0.9,*/*;q=0.5",
      ...headers,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 403 || response.status === 429) {
    throw new CoverRateLimitError(source, response.status);
  }
  return response;
}

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return ".jpg";
}

async function markAttempt(bookId: number, source: typeof COVER_NOT_FOUND_SOURCE | typeof COVER_ERROR_SOURCES[number]) {
  await prisma.book.update({
    where: { id: bookId },
    data: { coverSource: source, coverFetchedAt: new Date() },
  });
}

async function lookupCover(source: CoverSourceName, book: CoverBook) {
  if (source === "qidian") {
    const response = await fetchWithTimeout(
      source,
      `https://m.qidian.com/search?kw=${encodeURIComponent(book.title)}`,
      { Accept: "text/html,application/xhtml+xml" },
    );
    if (!response.ok) throw new Error(`起点检索失败：HTTP ${response.status}`);
    return findQidianCover(book, await response.text());
  }

  if (source === "qq") {
    const response = await fetchWithTimeout(
      source,
      `https://book.qq.com/so/${encodeURIComponent(book.title)}`,
      { Accept: "text/html,application/xhtml+xml" },
    );
    if (!response.ok) throw new Error(`QQ 阅读检索失败：HTTP ${response.status}`);
    return findQqCover(book, await response.text());
  }

  const response = await fetchWithTimeout(
    source,
    `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(book.title)}`,
  );
  if (!response.ok) throw new Error(`豆瓣检索失败：HTTP ${response.status}`);
  return findDoubanCover(book, await response.json());
}

async function saveCover(book: CoverBook, candidate: CoverCandidate) {
  const imageResponse = await fetchWithTimeout(candidate.source, candidate.imageUrl, { Referer: candidate.referer });
  if (!imageResponse.ok) throw new Error(`${candidate.source} 封面下载失败：HTTP ${imageResponse.status}`);
  const contentType = imageResponse.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`${candidate.source} 封面响应不是图片`);
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (bytes.length < 1_024 || bytes.length > 10 * 1_024 * 1_024) throw new Error(`${candidate.source} 封面大小异常：${bytes.length}`);

  await mkdir(realCoverRoot, { recursive: true });
  const extension = imageExtension(contentType);
  const fileName = `${book.id}${extension}`;
  const temporaryPath = path.join(realCoverRoot, `${fileName}.${Date.now()}.tmp`);
  const finalPath = path.join(realCoverRoot, fileName);
  await writeFile(temporaryPath, bytes, { flag: "wx" });
  await rename(temporaryPath, finalPath);

  await prisma.book.update({
    where: { id: book.id },
    data: {
      coverPath: `/covers/real/${fileName}`,
      coverSource: `${candidate.source}:${candidate.id}`,
      coverSourceUrl: candidate.imageUrl,
      coverFetchedAt: new Date(),
    },
  });

  console.info(`[cover-fetch] 已保存封面：${book.title} -> /covers/real/${fileName} (${candidate.source})`);
}

async function fetchBookCover(bookId: number) {
  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      status: "APPROVED",
      hasContent: true,
      score: { gte: MIN_BOOK_SCORE },
    },
    select: {
      id: true,
      title: true,
      author: true,
      coverPath: true,
      coverSource: true,
      coverFetchedAt: true,
    },
  });

  if (!book || await realCoverExists(book.coverPath)) return;
  const cooldown = cooldownFor(book.coverSource);
  if (book.coverFetchedAt && cooldown > 0 && Date.now() - book.coverFetchedAt.getTime() < cooldown) return;

  let hadError = false;
  let hadRateLimit = false;

  for (const source of COVER_SOURCES) {
    if ((queueState.sourceBlockedUntil[source] || 0) > Date.now()) {
      hadRateLimit = true;
      continue;
    }

    try {
      const candidate = await lookupCover(source, book);
      if (!candidate) continue;
      await saveCover(book, candidate);
      return;
    } catch (error) {
      if (error instanceof CoverRateLimitError) {
        hadRateLimit = true;
        queueState.sourceBlockedUntil[source] = Date.now() + RATE_LIMIT_COOLDOWN;
        console.warn(`[cover-fetch] ${error.message}，暂停该来源 6 小时并尝试后备来源。`);
        continue;
      }
      hadError = true;
      console.warn(`[cover-fetch] ${book.title} (${source}):`, error);
    }
  }

  const attemptSource = hadError
    ? "covers:error"
    : hadRateLimit
      ? "covers:rate_limited"
      : COVER_NOT_FOUND_SOURCE;
  await markAttempt(book.id, attemptSource);
  console.info(`[cover-fetch] 未取得封面 (${attemptSource})：${book.title} / ${book.author}`);
}

function allSourcesBlocked() {
  return COVER_SOURCES.every((source) => (queueState.sourceBlockedUntil[source] || 0) > Date.now());
}

export function queueBookCoverFetch(bookId: number): CoverFetchRequest {
  if (allSourcesBlocked()) return { status: "blocked", completion: null };
  if (queueState.queued.has(bookId)) {
    return { status: "duplicate", completion: queueState.completions.get(bookId) || null };
  }
  if (queueState.queued.size >= MAX_PENDING_BOOKS) return { status: "busy", completion: null };

  queueState.queued.add(bookId);
  const completion = queueState.chain
    .catch(() => undefined)
    .then(() => fetchBookCover(bookId))
    .catch((error) => console.warn(`[cover-fetch] 书籍 ${bookId} 后台任务失败:`, error))
    .finally(() => {
      queueState.queued.delete(bookId);
      queueState.completions.delete(bookId);
    });

  queueState.completions.set(bookId, completion);
  queueState.chain = completion;
  return { status: "queued", completion };
}
