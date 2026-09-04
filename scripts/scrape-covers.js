/**
 * 为高分且有正文的作品低频抓取封面。
 *
 * 默认行为：单并发、每次最多处理 100 本、请求间随机等待 4.5~7.5 秒，
 * 命中/未命中均写入可续跑状态；来源出现 403/429 后本批不再请求该来源。
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
const { findDoubanCover, findQidianCover, findQqCover } = require("./cover-sources");

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
const coverSources = ["qidian", "qq", "douban"];
const blockedSources = new Set();
let nextRequestAt = 0;

if (![minScore, limit, delayMin, delayMax].every(Number.isFinite) || (bookId !== null && !Number.isFinite(bookId)) || delayMin < 1000 || delayMax < delayMin) {
  throw new Error("参数无效：评分/数量需为数字，请求间隔不得低于 1000ms");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function randomDelay() {
  return Math.round(delayMin + Math.random() * (delayMax - delayMin));
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

async function fetchWithTimeout(source, url, options = {}) {
  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait > 0) await sleep(wait);
  nextRequestAt = Date.now() + randomDelay();

  const response = await fetch(url, {
    ...options,
    headers: { "User-Agent": userAgent, Accept: "application/json,image/*;q=0.9,*/*;q=0.5", ...(options.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 403 || response.status === 429) {
    const error = new Error(`${source} 返回 HTTP ${response.status}`);
    error.blockSource = source;
    throw error;
  }
  return response;
}

function extensionFor(contentType) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  return ".jpg";
}

async function lookupCover(source, book) {
  if (source === "qidian") {
    const response = await fetchWithTimeout(
      source,
      `https://m.qidian.com/search?kw=${encodeURIComponent(book.title)}`,
      { headers: { Accept: "text/html,application/xhtml+xml" } },
    );
    if (!response.ok) throw new Error(`起点检索 HTTP ${response.status}`);
    return findQidianCover(book, await response.text());
  }

  if (source === "qq") {
    const response = await fetchWithTimeout(
      source,
      `https://book.qq.com/so/${encodeURIComponent(book.title)}`,
      { headers: { Accept: "text/html,application/xhtml+xml" } },
    );
    if (!response.ok) throw new Error(`QQ 阅读检索 HTTP ${response.status}`);
    return findQqCover(book, await response.text());
  }

  const response = await fetchWithTimeout(
    source,
    `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(book.title)}`,
  );
  if (!response.ok) throw new Error(`豆瓣建议接口 HTTP ${response.status}`);
  return findDoubanCover(book, await response.json());
}

async function downloadCover(book, candidate) {
  const response = await fetchWithTimeout(candidate.source, candidate.imageUrl, { headers: { Referer: candidate.referer } });
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

async function findAndDownloadCover(book) {
  let hadError = blockedSources.size > 0;

  for (const source of coverSources) {
    if (blockedSources.has(source)) continue;

    try {
      const candidate = await lookupCover(source, book);
      if (!candidate) continue;
      const coverPath = await downloadCover(book, candidate);
      return { candidate, coverPath, hadError };
    } catch (error) {
      hadError = true;
      if (error.blockSource) {
        blockedSources.add(error.blockSource);
        console.warn(`${error.message}，本批暂停该来源并继续后备来源。`);
      } else {
        console.warn(`${book.title} (${source}): ${error.message}`);
      }
    }
  }

  return { candidate: null, coverPath: null, hadError };
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
  console.log(`来源顺序：起点移动站 -> QQ 阅读 -> 豆瓣；书名+作者严格匹配。`);
  console.log(`单并发，每次外部请求间隔 ${delayMin}~${delayMax}ms；遇到 403/429 将暂停对应来源。`);

  for (let index = 0; index < batch.length; index++) {
    const book = batch[index];
    try {
      const result = await findAndDownloadCover(book);
      if (!result.candidate) {
        if (result.hadError) {
          failed++;
          state.books[book.id] = { status: "error", title: book.title, author: book.author, checkedAt: new Date().toISOString() };
          console.log(`[${index + 1}/${batch.length}] 来源异常，未取得 ${book.title} / ${book.author}`);
        } else {
          missed++;
          state.books[book.id] = { status: "not_found", title: book.title, author: book.author, checkedAt: new Date().toISOString() };
          console.log(`[${index + 1}/${batch.length}] 所有来源均未命中 ${book.title} / ${book.author}`);
        }
      } else {
        await prisma.book.update({
          where: { id: book.id },
          data: {
            coverPath: result.coverPath,
            coverSource: `${result.candidate.source}:${result.candidate.id}`,
            coverSourceUrl: result.candidate.imageUrl,
            coverFetchedAt: new Date(),
          },
        });
        matched++;
        state.books[book.id] = {
          status: "matched",
          title: book.title,
          source: result.candidate.source,
          sourceId: result.candidate.id,
          coverPath: result.coverPath,
          checkedAt: new Date().toISOString(),
        };
        console.log(`[${index + 1}/${batch.length}] 已保存 ${book.title} -> ${result.coverPath} (${result.candidate.source})`);
      }
    } catch (error) {
      failed++;
      state.books[book.id] = { status: "error", title: book.title, message: error.message, checkedAt: new Date().toISOString() };
      console.error(`[${index + 1}/${batch.length}] ${book.title}: ${error.message}`);
      saveState(state);
    }
    saveState(state);
    if (blockedSources.size === coverSources.length) {
      console.warn("所有封面来源都已暂停，本批提前结束。");
      break;
    }
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
