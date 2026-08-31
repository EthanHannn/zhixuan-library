/**
 * 补匹配：用文件夹名首段 POST序号 精确匹配 catalog 中未匹配到正文的书
 * 用法: node scripts/rematch.js
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

const CHAPTER_RE = /^第[0-9零一二三四五六七八九十百千万两]{1,6}[章节回集部篇]/;
const VOLUME_RE = /^第[0-9零一二三四五六七八九十百千万两]{1,6}卷/;
const CHAPTER_PART_RE = /第[0-9零一二三四五六七八九十百千万两]{1,6}[章节回集部篇]/;
const SPECIAL_RE = /^(楔子|序章|序言|引子|前言|尾声|终章|后记|番外|完本感言|上架感言|新书感言|作品相关|外传|后传|内容简介|正文)/;
const BANNER_RE = /^(=+|-+)$|更多精校小说|知轩藏书下载|www\.zxcs|作者[:：]|内容简介[:：]|^正文\s*$/;

function detectEncoding(buf) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, 8192));
    return "utf-8";
  } catch {
    return "gb18030";
  }
}

function* scanLines(buf, encoding) {
  const dec = new TextDecoder(encoding);
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) {
      let end = i;
      if (end > start && buf[end - 1] === 0x0d) end--;
      yield { text: dec.decode(buf.subarray(start, end)), start, end: i };
      start = i + 1;
    }
  }
}

function indexChapters(buf, encoding) {
  const chapters = [];
  let started = false;
  let last = null;
  for (const line of scanLines(buf, encoding)) {
    const t = line.text.trim();
    if (!t) continue;
    if (!started) {
      if (BANNER_RE.test(t)) continue;
      if (CHAPTER_RE.test(t) || SPECIAL_RE.test(t)) started = true;
      else continue;
    }
    if (CHAPTER_RE.test(t) || SPECIAL_RE.test(t)) {
      let title = t;
      if (VOLUME_RE.test(t)) {
        const m = CHAPTER_PART_RE.exec(t);
        if (m) title = t.slice(m.index);
      }
      if (last) last.endOffset = line.start;
      last = { idx: chapters.length + 1, title, startOffset: line.start, endOffset: buf.length };
      chapters.push(last);
    } else if (VOLUME_RE.test(t) && !CHAPTER_RE.test(t)) {
      if (last) last.endOffset = line.start;
      last = { idx: chapters.length + 1, title: t, startOffset: line.start, endOffset: buf.length };
      chapters.push(last);
    }
  }
  return chapters;
}

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

async function main() {
  // 1) 扫描文件夹，建立 postId -> txt 绝对路径
  const byPostId = new Map();
  let totalFiles = 0;
  if (!fs.existsSync(NOVEL_ROOT)) throw new Error("NOVEL_ROOT 不存在: " + NOVEL_ROOT);
  for (const dir of fs.readdirSync(NOVEL_ROOT)) {
    if (!dir.startsWith("知轩藏书6755本_")) continue;
    const sub = path.join(NOVEL_ROOT, dir);
    if (!fs.statSync(sub).isDirectory()) continue;
    for (const bookDir of fs.readdirSync(sub)) {
      const bd = path.join(sub, bookDir);
      if (!fs.statSync(bd).isDirectory()) continue;
      const m = /^(\d+)_/.exec(bookDir);
      const postId = m ? parseInt(m[1]) : null;
      for (const f of fs.readdirSync(bd)) {
        if (!f.toLowerCase().endsWith(".txt")) continue;
        totalFiles++;
        if (postId && !byPostId.has(postId)) byPostId.set(postId, path.join(bd, f));
      }
    }
  }
  console.log("扫描完成: 文件", totalFiles, "有postId的", byPostId.size);

  // 2) 找出 hasContent=false 的书，按 postId 匹配
  const missing = await prisma.book.findMany({
    where: { hasContent: false },
    select: { id: true, title: true, author: true, postId: true },
  });
  console.log("无正文书籍:", missing.length);

  let matched = 0;
  const stillMissing = [];
  for (const book of missing) {
    let filePath = null;
    if (book.postId) filePath = byPostId.get(book.postId) || null;
    if (!filePath) {
      stillMissing.push(book);
      continue;
    }
    // 读正文、索引章节
    const buf = fs.readFileSync(filePath);
    const encoding = detectEncoding(buf);
    let chapters = indexChapters(buf, encoding);
    if (chapters.length === 0) chapters = singleChapterIndex(buf, encoding);

    await prisma.book.update({
      where: { id: book.id },
      data: {
        filePath: path.relative(NOVEL_ROOT, filePath).replace(/\\/g, "/"),
        hasContent: true,
        chapterCount: chapters.length,
      },
    });
    for (let c = 0; c < chapters.length; c += 1000) {
      await prisma.chapter.createMany({
        data: chapters.slice(c, c + 1000).map((ch) => ({
          bookId: book.id,
          idx: ch.idx,
          title: ch.title.slice(0, 200),
          startOffset: ch.startOffset,
          endOffset: ch.endOffset,
        })),
      });
    }
    matched++;
  }

  console.log(`补匹配成功: ${matched}, 仍缺: ${stillMissing.length}`);
  if (stillMissing.length) {
    console.log("仍缺样例:", stillMissing.slice(0, 15).map((b) => `${b.title}/${b.author}/post=${b.postId}`).join(" | "));
  }
}

main()
  .catch((e) => { console.error("失败:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
