/**
 * 全量导入脚本：catalog.json 元数据 + 本地 TXT 正文
 * - 扫描 NOVEL_ROOT 下 6 个分卷文件夹，解析 TXT
 * - GB18030/UTF-8 编码感知，按行建立章节字节偏移索引
 * - 为每本书生成封面 SVG 到 public/covers/{id}.svg
 * - 入库 Book + Chapter
 *
 * 用法: node scripts/import-full.js [--reset]
 * 注意: --reset 会清空现有书籍、章节、投票、评论和阅读进度
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const NOVEL_ROOT = process.env.NOVEL_ROOT;
if (!NOVEL_ROOT) {
  throw new Error("缺少 NOVEL_ROOT 环境变量，请在 .env 中配置小说根目录");
}
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const COVER_DIR = path.join(PUBLIC_DIR, "covers");
const RESET = process.argv.includes("--reset");

// ---------------- 章节模式 ----------------
const CHAPTER_RE = /^第[0-9零一二三四五六七八九十百千万两]{1,6}[章节回集部篇]/;
const VOLUME_RE = /^第[0-9零一二三四五六七八九十百千万两]{1,6}卷/;
const CHAPTER_PART_RE = /第[0-9零一二三四五六七八九十百千万两]{1,6}[章节回集部篇]/;
const SPECIAL_RE = /^(楔子|序章|序言|引子|前言|尾声|终章|后记|番外|完本感言|上架感言|新书感言|作品相关|外传|后传|内容简介|正文)/;
const BANNER_RE = /^(=+|-+)$|更多精校小说|知轩藏书下载|www\.zxcs|作者[:：]|内容简介[:：]|^正文\s*$/;

// ---------------- 编码与行扫描 ----------------
function detectEncoding(buf) {
  try {
    const sample = buf.subarray(0, 8192);
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: sample.length < buf.length });
    return "utf-8";
  } catch {
    return "gb18030";
  }
}

/**
 * 逐行扫描 GB18030 缓冲区，返回 [{ text, start, end }]
 * start=行首字节偏移, end=换行符后的偏移（下一行起点）
 * 说明: GB18030 的 trail byte 不可能是 0x0A，行边界一定是字符边界，
 * 因此可复用同一个 TextDecoder 逐行解码。
 */
function* scanLines(buf, encoding) {
  const dec = new TextDecoder(encoding);
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) {
      let end = i;
      if (end > start && buf[end - 1] === 0x0d) end--;
      const text = dec.decode(buf.subarray(start, end));
      yield { text, start, end: i };
      start = i + 1;
    }
  }
}

// ---------------- 章节索引 ----------------
function indexChapters(buf, encoding) {
  const chapters = [];
  let started = false; // 是否已进入正文（跳过文件头 banner/简介）
  let last = null;

  for (const line of scanLines(buf, encoding)) {
    const t = line.text.trim();
    if (!t) continue;
    if (!started) {
      if (BANNER_RE.test(t)) continue;
      if (CHAPTER_RE.test(t) || SPECIAL_RE.test(t)) {
        started = true;
        // fall through to register
      } else {
        continue; // 正文开始前的其他行（书名/作者/简介段落）跳过
      }
    }
    if (CHAPTER_RE.test(t) || SPECIAL_RE.test(t)) {
      let title = t;
      // 组合行 "第一卷 xx 第一章 yy" → 取章节部分
      if (VOLUME_RE.test(t)) {
        const m = CHAPTER_PART_RE.exec(t);
        if (m) title = t.slice(m.index);
      }
      if (last) last.endOffset = line.start;
      last = { idx: chapters.length + 1, title, startOffset: line.start, endOffset: buf.length };
      chapters.push(last);
    } else if (VOLUME_RE.test(t) && !CHAPTER_RE.test(t)) {
      // 纯卷标题（如 "第一卷 时来运转"）作为目录条目
      if (last) last.endOffset = line.start;
      last = { idx: chapters.length + 1, title: t, startOffset: line.start, endOffset: buf.length };
      chapters.push(last);
    }
  }
  return chapters;
}

// 无章节文件 → 整篇作为一章（跳过 banner 头）
function singleChapterIndex(buf, encoding) {
  const dec = new TextDecoder(encoding);
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) {
      let end = i;
      if (end > start && buf[end - 1] === 0x0d) end--;
      const t = dec.decode(buf.subarray(start, end)).trim();
      if (t && !BANNER_RE.test(t)) {
        return [{ idx: 1, title: "全文", startOffset: start, endOffset: buf.length }];
      }
      start = i + 1;
    }
  }
  return [{ idx: 1, title: "全文", startOffset: 0, endOffset: buf.length }];
}

// ---------------- 封面生成 ----------------
const TAG_COLORS = [
  ["仙侠", ["#0f766e", "#134e4a"]],
  ["玄幻", ["#6d28d9", "#4c1d95"]],
  ["都市", ["#1d4ed8", "#1e3a8a"]],
  ["科幻", ["#0891b2", "#155e75"]],
  ["历史", ["#92400e", "#78350f"]],
  ["游戏", ["#15803d", "#14532d"]],
  ["灵异", ["#334155", "#1e293b"]],
  ["武侠", ["#b91c1c", "#7f1d1d"]],
  ["竞技", ["#ea580c", "#9a3412"]],
  ["军事", ["#4d7c0f", "#3f6212"]],
  ["奇幻", ["#4338ca", "#312e81"]],
  ["二次元", ["#be185d", "#831843"]],
];
const DEFAULT_COLORS = ["#334155", "#1e293b"];

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function coverSvg(book) {
  const [c1, c2] = (TAG_COLORS.find(([k]) => book.tag1 && book.tag1.includes(k)) || [null, DEFAULT_COLORS])[1] || DEFAULT_COLORS;
  const W = 300, H = 420;
  const title = book.title || "未命名";
  const charsPerLine = 7;
  const lines = [];
  for (let i = 0; i < title.length; i += charsPerLine) lines.push(title.slice(i, i + charsPerLine));
  const shown = lines.slice(0, 4);
  const tpl = (y) => shown.map((l, i) => `<text x="${W / 2}" y="${y + i * 46}" text-anchor="middle" font-size="34" font-weight="bold" fill="#ffffff" font-family="'Noto Serif SC','SimSun',serif">${escapeXml(l)}</text>`).join("");
  const author = book.author ? `著 · ${escapeXml(book.author)}` : "";
  const scoreBadge = book.score > 0 ? `<circle cx="${W - 30}" cy="30" r="22" fill="rgba(255,255,255,0.92)"/><text x="${W - 30}" y="37" text-anchor="middle" font-size="20" font-weight="bold" fill="${c1}">${book.score.toFixed(1)}</text>` : "";
  const tagPill = book.tag1 ? `<rect x="16" y="14" rx="12" ry="12" width="${12 + book.tag1.length * 16}" height="26" fill="rgba(255,255,255,0.18)"/><text x="${16 + 6 + book.tag1.length * 8}" y="32" text-anchor="middle" font-size="14" fill="rgba(255,255,255,0.92)">${escapeXml(book.tag1)}</text>` : "";
  const titleY = H / 2 - ((shown.length - 1) * 46) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="${W - 40}" cy="${H - 60}" r="120" fill="rgba(255,255,255,0.06)"/>
  <circle cx="30" cy="80" r="60" fill="rgba(255,255,255,0.05)"/>
  ${tagPill}
  ${scoreBadge}
  ${tpl(titleY)}
  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-size="16" fill="rgba(255,255,255,0.85)" font-family="'Noto Sans SC','Microsoft YaHei',sans-serif">${author}</text>
  <rect x="16" y="${H - 84}" width="44" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"/>
</svg>`;
}

// ---------------- 文件扫描与匹配 ----------------
function scanNovelFiles() {
  const map = new Map(); // 文件名(去扩展名) -> 绝对路径
  if (!fs.existsSync(NOVEL_ROOT)) throw new Error("NOVEL_ROOT 不存在: " + NOVEL_ROOT);
  for (const dir of fs.readdirSync(NOVEL_ROOT)) {
    if (!dir.startsWith("知轩藏书6755本_")) continue;
    const sub = path.join(NOVEL_ROOT, dir);
    if (!fs.statSync(sub).isDirectory()) continue;
    for (const bookDir of fs.readdirSync(sub)) {
      const bd = path.join(sub, bookDir);
      if (!fs.statSync(bd).isDirectory()) continue;
      for (const f of fs.readdirSync(bd)) {
        if (!f.toLowerCase().endsWith(".txt")) continue;
        map.set(path.basename(f, ".txt"), path.join(bd, f));
      }
    }
  }
  return map;
}

function normalizeTitle(t) {
  return String(t).replace(/[《》（）()\s]/g, "").toLowerCase();
}

function matchFile(book, fileMap) {
  // 1) 精确书名+作者
  const exact = fileMap.get(normalizeTitle(book.title + book.author));
  if (exact) return exact;
  // 2) 文件名包含书名且包含作者
  for (const [key, p] of fileMap) {
    if (key.includes(normalizeTitle(book.title)) && key.includes(normalizeTitle(book.author))) return p;
  }
  return null;
}

// ---------------- 主流程 ----------------
async function main() {
  if (RESET) {
    console.log("--reset: 清空 books/chapters/votes/comments/progress...");
    await prisma.$executeRawUnsafe("DELETE FROM reading_progress");
    await prisma.$executeRawUnsafe("DELETE FROM chapters");
    await prisma.$executeRawUnsafe("DELETE FROM votes");
    await prisma.$executeRawUnsafe("DELETE FROM comments");
    await prisma.$executeRawUnsafe("DELETE FROM books");
  }

  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
  console.log("catalog books:", catalog.length);

  fs.mkdirSync(COVER_DIR, { recursive: true });
  const fileMap = scanNovelFiles();
  console.log("novel txt files found:", fileMap.size);

  let matched = 0, noFile = 0, chapterTotal = 0, singleChapBooks = 0;
  const unmatchedFiles = [];
  const startTime = Date.now();

  for (let i = 0; i < catalog.length; i++) {
    const book = catalog[i];
    const filePath = matchFile(book, fileMap);
    if (filePath) {
      fileMap.delete(normalizeTitle(book.title + book.author)); // 防重复匹配
      matched++;
    } else {
      noFile++;
    }

    // 建立书籍记录
    const created = await prisma.book.create({
      data: {
        title: book.title,
        author: book.author,
        tag1: book.tag1,
        tag2: book.tag2,
        size: book.size,
        intro: book.intro,
        popularity: book.popularity,
        totalScore: book.totalScore,
        score: book.score,
        status: "APPROVED",
        xiancaoCount: book.xiancao,
        liangcaoCount: book.liangcao,
        gancaoCount: book.gancao,
        kucaoCount: book.kucao,
        ducaoCount: book.ducao,
        postId: book.postId || null,
        filePath: filePath ? path.relative(NOVEL_ROOT, filePath).replace(/\\/g, "/") : null,
        hasContent: !!filePath,
        chapterCount: 0,
      },
    });

    // 生成封面
    fs.writeFileSync(path.join(COVER_DIR, created.id + ".svg"), coverSvg(book), "utf8");

    if (!filePath) continue;

    // 读取并索引章节
    const buf = fs.readFileSync(filePath);
    const encoding = detectEncoding(buf);
    let chapters = indexChapters(buf, encoding);
    if (chapters.length === 0) {
      chapters = singleChapterIndex(buf, encoding);
      singleChapBooks++;
    }
    chapterTotal += chapters.length;
    await prisma.book.update({
      where: { id: created.id },
      data: { chapterCount: chapters.length },
    });

    // 批量插入章节
    for (let c = 0; c < chapters.length; c += 1000) {
      const chunk = chapters.slice(c, c + 1000);
      await prisma.chapter.createMany({
        data: chunk.map((ch) => ({
          bookId: created.id,
          idx: ch.idx,
          title: ch.title.slice(0, 200),
          startOffset: ch.startOffset,
          endOffset: ch.endOffset,
        })),
      });
    }

    if ((i + 1) % 500 === 0) {
      const sec = Math.round((Date.now() - startTime) / 1000);
      console.log(`  progress ${i + 1}/${catalog.length}  matched=${matched}  chapters=${chapterTotal}  ${sec}s`);
    }
  }

  // 未匹配文件统计
  for (const key of fileMap.keys()) unmatchedFiles.push(key);
  const sec = Math.round((Date.now() - startTime) / 1000);
  console.log("\n=== 导入完成 ===");
  console.log(`用时: ${sec}s`);
  console.log(`书籍总数: ${catalog.length}`);
  console.log(`匹配到正文: ${matched}  无正文: ${noFile}`);
  console.log(`章节总数: ${chapterTotal}  单章(无章节标记)书籍: ${singleChapBooks}`);
  console.log(`未匹配的文件: ${unmatchedFiles.length}`);
  if (unmatchedFiles.length) console.log("  样例:", unmatchedFiles.slice(0, 10).join(" | "));
}

main()
  .catch((e) => { console.error("导入失败:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
