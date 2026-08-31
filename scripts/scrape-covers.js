/**
 * 为高分且有正文的作品低频抓取封面。
 *
 * 默认行为：单并发、每次最多处理 100 本、请求间随机等待 4.5~7.5 秒，
 * 命中/未命中均写入可续跑状态；遇到 403/429 立即停止，不尝试绕过限制。
 *
 * 用法：
 *   npm run scrape:covers
 *   node scripts/scrape-covers.js --limit 300
 *   node scripts/scrape-covers.js --limit 0 --min-score 7.5
 *   node scripts/scrape-covers.js --book-id 1
 *   node scripts/scrape-covers.js --retry-misses
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const projectRoot = path.join(__dirname, "..");
const coverRoot = path.join(projectRoot, "public", "covers", "real");
const statePath = path.join(projectRoot, "var", "cover-scrape-state.json");

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const minScore = Number(getArg("--min-score", process.env.MIN_BOOK_SCORE || "7.5"));
const limit = Number(getArg("--limit", "100"));
const bookIdArg = getArg("--book-id", null);
const bookId = bookIdArg === null ? null : Number(bookIdArg);
const delayMin = Number(getArg("--delay-min", "4500"));
const delayMax = Number(getArg("--delay-max", "7500"));
const retryMisses = process.argv.includes("--retry-misses");
const userAgent = process.env.COVER_FETCH_USER_AGENT || "zhixuan-library-cover-fetcher/1.0 (private-library; sequential requests)";

if (![minScore, limit, delayMin, delayMax].every(Number.isFinite) || (bookId !== null && !Number.isFinite(bookId)) || delayMin < 1000 || delayMax < delayMin) {
  throw new Error("参数无效：评分/数量需为数字，请求间隔不得低于 1000ms");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function randomDelay() {
  return Math.round(delayMin + Math.random() * (delayMax - delayMin));
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[《》〈〉（）()\[\]【】·:：,，.。\s_-]/g, "");
}

function loadState() {
  if (!fs.existsSync(statePath)) return { books: {} };
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { books: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { "User-Agent": userAgent, Accept: "application/json,image/*;q=0.9,*/*;q=0.5", ...(options.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
}

function chooseSuggestion(book, suggestions) {
  const wantedTitle = normalize(book.title);
  const wantedAuthor = normalize(book.author);
  return suggestions.find((candidate) => {
    const title = normalize(candidate.title);
    const author = normalize(candidate.author_name);
    const titleMatches = title === wantedTitle || title.includes(wantedTitle) || wantedTitle.includes(title);
    const authorMatches = author && (author === wantedAuthor || author.includes(wantedAuthor) || wantedAuthor.includes(author));
    return titleMatches && authorMatches && candidate.pic;
  }) || null;
}

function extensionFor(contentType) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  return ".jpg";
}

async function fetchSuggestion(book) {
  const endpoint = `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(book.title)}`;
  const response = await fetchWithTimeout(endpoint);
  if (response.status === 403 || response.status === 429) {
    const error = new Error(`来源站返回 ${response.status}，已停止本批任务`);
    error.stopRun = true;
    throw error;
  }
  if (!response.ok) throw new Error(`建议接口 HTTP ${response.status}`);
  return chooseSuggestion(book, await response.json());
}

async function downloadCover(book, suggestion) {
  await sleep(800 + Math.round(Math.random() * 700));
  const response = await fetchWithTimeout(suggestion.pic, { headers: { Referer: "https://book.douban.com/" } });
  if (response.status === 403 || response.status === 429) {
    const error = new Error(`图片站返回 ${response.status}，已停止本批任务`);
    error.stopRun = true;
    throw error;
  }
  if (!response.ok) throw new Error(`图片下载 HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`响应不是图片：${contentType || "unknown"}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024 || buffer.length > 10 * 1024 * 1024) throw new Error(`图片大小异常：${buffer.length}`);

  const extension = extensionFor(contentType);
  const fileName = `${book.id}${extension}`;
  const absolutePath = path.join(coverRoot, fileName);
  fs.mkdirSync(coverRoot, { recursive: true });
  fs.writeFileSync(absolutePath, buffer);
  return `/covers/real/${fileName}`;
}

async function main() {
  const state = loadState();
  const candidates = await prisma.book.findMany({
    where: { score: { gte: minScore }, hasContent: true, filePath: { not: null }, coverPath: null, ...(bookId === null ? {} : { id: bookId }) },
    select: { id: true, title: true, author: true, score: true },
    orderBy: [{ score: "desc" }, { id: "asc" }],
  });
  const queue = candidates.filter((book) => retryMisses || state.books[book.id]?.status !== "not_found");
  const batch = limit > 0 ? queue.slice(0, limit) : queue;
  let matched = 0;
  let missed = 0;
  let failed = 0;

  console.log(`待处理 ${queue.length} 本，本批 ${batch.length} 本；评分下限 ${minScore}`);
  console.log(`单并发，请求间隔 ${delayMin}~${delayMax}ms；遇到 403/429 将立即停止。`);

  for (let index = 0; index < batch.length; index++) {
    const book = batch[index];
    if (index > 0) await sleep(randomDelay());
    try {
      const suggestion = await fetchSuggestion(book);
      if (!suggestion) {
        missed++;
        state.books[book.id] = { status: "not_found", title: book.title, author: book.author, checkedAt: new Date().toISOString() };
        console.log(`[${index + 1}/${batch.length}] 未命中 ${book.title} / ${book.author}`);
      } else {
        const coverPath = await downloadCover(book, suggestion);
        await prisma.book.update({
          where: { id: book.id },
          data: { coverPath, coverSource: `douban:${suggestion.id}`, coverSourceUrl: suggestion.pic, coverFetchedAt: new Date() },
        });
        matched++;
        state.books[book.id] = { status: "matched", title: book.title, sourceId: suggestion.id, coverPath, checkedAt: new Date().toISOString() };
        console.log(`[${index + 1}/${batch.length}] 已保存 ${book.title} -> ${coverPath}`);
      }
    } catch (error) {
      failed++;
      state.books[book.id] = { status: "error", title: book.title, message: error.message, checkedAt: new Date().toISOString() };
      console.error(`[${index + 1}/${batch.length}] ${book.title}: ${error.message}`);
      saveState(state);
      if (error.stopRun) break;
    }
    saveState(state);
  }

  console.log(`本批结束：命中 ${matched}，未命中 ${missed}，失败 ${failed}`);
  console.log(`状态文件：${statePath}`);
}

main()
  .catch((error) => {
    console.error("封面任务失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
