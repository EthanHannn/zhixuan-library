/**
 * 定向导入少量本地 TXT，不清空现有书目、账号、评论或阅读进度。
 *
 * 用法：
 *   node scripts/import-manual-books.js --manifest /path/to/manual-books.json
 *   node scripts/import-manual-books.js --manifest /path/to/manual-books.json --dry-run
 *
 * manifest 是数组，每项至少包含：title、author、tag1、tag2、size、intro、
 * score、filePath。filePath 必须是 NOVEL_ROOT 内的相对路径。
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const MIN_SCORE = 7.5;

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function detectEncoding(buffer) {
  try {
    const sample = buffer.subarray(0, 8192);
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: sample.length < buffer.length });
    return "utf-8";
  } catch {
    return "gb18030";
  }
}

function scanLines(buffer, encoding) {
  const decoder = new TextDecoder(encoding);
  const lines = [];
  let start = 0;
  for (let index = 0; index <= buffer.length; index++) {
    if (index !== buffer.length && buffer[index] !== 0x0a) continue;
    let end = index;
    if (end > start && buffer[end - 1] === 0x0d) end--;
    lines.push({
      text: decoder.decode(buffer.subarray(start, end)).replace(/^\uFEFF/, ""),
      start,
      nextStart: index < buffer.length ? index + 1 : index,
    });
    start = index + 1;
  }
  return lines;
}

function indexChapters(buffer) {
  const encoding = detectEncoding(buffer);
  const lines = scanLines(buffer, encoding);
  const spacedNumbers = new Set();
  const spacedPattern = /^\s*第(\d+)章\s+(.+?)\s*$/;
  const compactPattern = /^\s*第(\d+)章(\S.*?)\s*$/;

  for (const line of lines) {
    const match = spacedPattern.exec(line.text);
    if (match) spacedNumbers.add(Number(match[1]));
  }

  const headings = [];
  for (const line of lines) {
    let match = spacedPattern.exec(line.text);
    if (!match) {
      match = compactPattern.exec(line.text);
      if (!match || spacedNumbers.has(Number(match[1]))) continue;
    }
    headings.push({ name: match[2].trim(), headingStart: line.start, contentStart: line.nextStart });
  }

  if (headings.length === 0) {
    return [{ idx: 1, title: "全文", startOffset: 0, endOffset: buffer.length }];
  }

  return headings.map((heading, index) => ({
    idx: index + 1,
    title: `第${index + 1}章 ${heading.name}`.slice(0, 200),
    startOffset: heading.contentStart,
    endOffset: index + 1 < headings.length ? headings[index + 1].headingStart : buffer.length,
  }));
}

function countTextCharacters(buffer, encoding) {
  const text = new TextDecoder(encoding).decode(buffer);
  return text.length - (text.match(/\s/g)?.length || 0);
}

function resolveNovelPath(novelRoot, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`filePath 必须是相对路径：${relativePath || "(空)"}`);
  }
  const root = path.resolve(novelRoot);
  const fullPath = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!fullPath.startsWith(prefix)) {
    throw new Error(`filePath 越过 NOVEL_ROOT：${relativePath}`);
  }
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`找不到正文文件：${fullPath}`);
  }
  return fullPath;
}

function validateBook(book, index) {
  for (const field of ["title", "author", "tag1", "tag2", "size", "intro", "filePath"]) {
    if (typeof book[field] !== "string" || !book[field].trim()) {
      throw new Error(`manifest[${index}].${field} 不能为空`);
    }
  }
  if (!Number.isFinite(book.score) || book.score < MIN_SCORE || book.score > 10) {
    throw new Error(`manifest[${index}].score 必须在 ${MIN_SCORE} 到 10 之间`);
  }
}

async function main() {
  const manifestArg = getArg("--manifest");
  const novelRoot = process.env.NOVEL_ROOT;
  const dryRun = process.argv.includes("--dry-run");
  if (!manifestArg) throw new Error("缺少 --manifest 参数");
  if (!novelRoot) throw new Error("缺少 NOVEL_ROOT 环境变量");

  const manifestPath = path.resolve(manifestArg);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("manifest 必须是非空数组");
  }

  const prepared = manifest.map((book, index) => {
    validateBook(book, index);
    const fullPath = resolveNovelPath(novelRoot, book.filePath);
    const buffer = fs.readFileSync(fullPath);
    const chapters = indexChapters(buffer);
    const encoding = detectEncoding(buffer);
    return { book, chapters, bytes: buffer.length, encoding, wordCount: countTextCharacters(buffer, encoding) };
  });

  for (const item of prepared) {
    console.log(`${item.book.title}：${item.chapters.length} 章，${item.encoding}，${item.bytes} bytes`);
  }
  if (dryRun) {
    console.log("dry-run 完成，未写入数据库。");
    return;
  }

  const results = await prisma.$transaction(async (tx) => {
    const imported = [];
    for (const { book, chapters, wordCount } of prepared) {
      const existing = await tx.book.findMany({
        where: { title: book.title, author: book.author },
        select: { id: true },
      });
      if (existing.length > 1) {
        throw new Error(`发现重复书目，拒绝自动更新：${book.title} / ${book.author}`);
      }

      const data = {
        title: book.title.trim(),
        author: book.author.trim(),
        tag1: book.tag1.trim(),
        tag2: book.tag2.trim(),
        size: book.size.trim(),
        intro: book.intro.trim(),
        popularity: Number.isInteger(book.popularity) ? book.popularity : 0,
        totalScore: Number.isInteger(book.totalScore) ? book.totalScore : 0,
        score: book.score,
        status: "APPROVED",
        postId: Number.isInteger(book.postId) ? book.postId : null,
        filePath: book.filePath.replace(/\\/g, "/"),
        chapterCount: chapters.length,
        wordCount,
        hasContent: true,
        coverPath: book.coverPath || null,
        coverSource: book.coverSource || null,
        coverSourceUrl: book.coverSourceUrl || null,
        coverFetchedAt: book.coverFetchedAt ? new Date(book.coverFetchedAt) : null,
      };

      let bookId;
      let action;
      if (existing.length === 1) {
        bookId = existing[0].id;
        await tx.chapter.deleteMany({ where: { bookId } });
        await tx.book.update({ where: { id: bookId }, data });
        action = "updated";
      } else {
        const created = await tx.book.create({ data, select: { id: true } });
        bookId = created.id;
        action = "created";
      }

      for (let index = 0; index < chapters.length; index += 1000) {
        await tx.chapter.createMany({
          data: chapters.slice(index, index + 1000).map((chapter) => ({ ...chapter, bookId })),
        });
      }
      imported.push({ id: bookId, title: book.title, chapterCount: chapters.length, action });
    }
    return imported;
  });

  for (const result of results) {
    console.log(`${result.action} bookId=${result.id} ${result.title} (${result.chapterCount} 章)`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
