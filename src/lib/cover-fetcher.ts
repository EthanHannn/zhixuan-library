import "server-only";

import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { MIN_BOOK_SCORE } from "@/lib/catalog";

interface CoverQueueState {
  chain: Promise<void>;
  queued: Set<number>;
  nextRequestAt: number;
  blockedUntil: number;
}

interface CoverSuggestion {
  id: string;
  title?: string;
  author_name?: string;
  pic?: string;
}

type QueueResult = "queued" | "duplicate" | "busy" | "blocked";

const globalForCoverQueue = globalThis as typeof globalThis & {
  zhixuanCoverQueue?: CoverQueueState;
};

const queueState = globalForCoverQueue.zhixuanCoverQueue || {
  chain: Promise.resolve(),
  queued: new Set<number>(),
  nextRequestAt: 0,
  blockedUntil: 0,
};

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

class CoverRateLimitError extends Error {}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalize(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[《》〈〉（）()\[\]【】·:：,，.。\s_-]/g, "");
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
  if (source === "douban:not_found") return NOT_FOUND_COOLDOWN;
  if (source === "douban:error" || source === "douban:rate_limited") return ERROR_COOLDOWN;
  return 0;
}

async function waitForRequestSlot() {
  const wait = Math.max(0, queueState.nextRequestAt - Date.now());
  if (wait > 0) await sleep(wait);
  queueState.nextRequestAt = Date.now() + 5_000 + Math.round(Math.random() * 3_000);
}

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}) {
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
    throw new CoverRateLimitError(`封面来源暂时限制访问：HTTP ${response.status}`);
  }
  return response;
}

function chooseSuggestion(title: string, author: string, suggestions: CoverSuggestion[]) {
  const wantedTitle = normalize(title);
  const wantedAuthor = normalize(author);
  return suggestions.find((candidate) => {
    if (!candidate.pic) return false;
    const candidateTitle = normalize(candidate.title);
    const candidateAuthor = normalize(candidate.author_name);
    const titleMatches = candidateTitle === wantedTitle || candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle);
    const authorMatches = candidateAuthor && (candidateAuthor === wantedAuthor || candidateAuthor.includes(wantedAuthor) || wantedAuthor.includes(candidateAuthor));
    return Boolean(titleMatches && authorMatches);
  }) || null;
}

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return ".jpg";
}

async function markAttempt(bookId: number, source: "douban:not_found" | "douban:error" | "douban:rate_limited") {
  await prisma.book.update({
    where: { id: bookId },
    data: { coverSource: source, coverFetchedAt: new Date() },
  });
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

  await waitForRequestSlot();

  try {
    const suggestionResponse = await fetchWithTimeout(`https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(book.title)}`);
    if (!suggestionResponse.ok) throw new Error(`封面检索失败：HTTP ${suggestionResponse.status}`);
    const suggestions = await suggestionResponse.json() as CoverSuggestion[];
    const suggestion = chooseSuggestion(book.title, book.author, suggestions);

    if (!suggestion?.pic) {
      await markAttempt(book.id, "douban:not_found");
      return;
    }

    await sleep(900 + Math.round(Math.random() * 600));
    const imageResponse = await fetchWithTimeout(suggestion.pic, { Referer: "https://book.douban.com/" });
    if (!imageResponse.ok) throw new Error(`封面下载失败：HTTP ${imageResponse.status}`);
    const contentType = imageResponse.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error("封面响应不是图片");
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length < 1_024 || bytes.length > 10 * 1_024 * 1_024) throw new Error(`封面大小异常：${bytes.length}`);

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
        coverSource: `douban:${suggestion.id}`,
        coverSourceUrl: suggestion.pic,
        coverFetchedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof CoverRateLimitError) {
      queueState.blockedUntil = Date.now() + RATE_LIMIT_COOLDOWN;
      await markAttempt(book.id, "douban:rate_limited");
      console.warn(`[cover-fetch] ${error.message}，暂停后台抓取 6 小时。`);
      return;
    }
    await markAttempt(book.id, "douban:error");
    console.warn(`[cover-fetch] ${book.title}:`, error);
  }
}

export function queueBookCoverFetch(bookId: number): QueueResult {
  if (queueState.blockedUntil > Date.now()) return "blocked";
  if (queueState.queued.has(bookId)) return "duplicate";
  if (queueState.queued.size >= MAX_PENDING_BOOKS) return "busy";

  queueState.queued.add(bookId);
  queueState.chain = queueState.chain
    .catch(() => undefined)
    .then(() => fetchBookCover(bookId))
    .catch((error) => console.warn(`[cover-fetch] 书籍 ${bookId} 后台任务失败:`, error))
    .finally(() => queueState.queued.delete(bookId));
  return "queued";
}
