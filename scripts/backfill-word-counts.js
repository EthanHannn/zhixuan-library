/**
 * 逐本流式统计正文非空白字符数，并回填 books.wordCount。
 * 数据库本身就是断点：默认只处理 wordCount=0 的正文，可安全重复执行。
 *
 * 用法：
 *   node scripts/backfill-word-counts.js
 *   node scripts/backfill-word-counts.js --limit 10 --dry-run
 *   node scripts/backfill-word-counts.js --all
 */
try {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
} catch (error) {
  // 生产 standalone 镜像直接使用容器环境变量，不包含仅供本地开发的 dotenv。
  if (error?.code !== "MODULE_NOT_FOUND") throw error;
}
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function resolveNovelPath(novelRoot, relativePath) {
  const root = path.resolve(novelRoot);
  const fullPath = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!fullPath.startsWith(prefix)) throw new Error(`正文路径越过 NOVEL_ROOT：${relativePath}`);
  return fullPath;
}

function detectFileEncoding(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  try {
    const sample = Buffer.alloc(8192);
    const bytesRead = fs.readSync(descriptor, sample, 0, sample.length, 0);
    const bytes = sample.subarray(0, bytesRead);
    new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: bytesRead === sample.length });
    return "utf-8";
  } catch {
    return "gb18030";
  } finally {
    fs.closeSync(descriptor);
  }
}

function countChunk(text) {
  return text.length - (text.match(/\s/g)?.length || 0);
}

async function countFileCharacters(filePath, encoding) {
  const decoder = new TextDecoder(encoding);
  let count = 0;
  const stream = fs.createReadStream(filePath, { highWaterMark: 512 * 1024 });
  for await (const chunk of stream) {
    count += countChunk(decoder.decode(chunk, { stream: true }));
  }
  count += countChunk(decoder.decode());
  return count;
}

async function main() {
  const novelRoot = process.env.NOVEL_ROOT;
  if (!novelRoot) throw new Error("缺少 NOVEL_ROOT 环境变量");
  const limitArg = Number(getArg("--limit") || "0");
  const dryRun = process.argv.includes("--dry-run");
  const includeExisting = process.argv.includes("--all");

  const books = await prisma.book.findMany({
    where: {
      hasContent: true,
      filePath: { not: null },
      ...(includeExisting ? {} : { wordCount: 0 }),
    },
    select: { id: true, title: true, filePath: true },
    orderBy: { id: "asc" },
  });

  const grouped = new Map();
  for (const book of books) {
    if (!book.filePath) continue;
    const group = grouped.get(book.filePath) || { path: book.filePath, books: [] };
    group.books.push({ id: book.id, title: book.title });
    grouped.set(book.filePath, group);
  }
  const files = [...grouped.values()].slice(0, limitArg > 0 ? limitArg : undefined);
  console.log(`待统计正文：${files.length} 个文件，关联 ${files.reduce((sum, item) => sum + item.books.length, 0)} 本书`);

  let completed = 0;
  let missing = 0;
  for (const item of files) {
    const fullPath = resolveNovelPath(novelRoot, item.path);
    if (!fs.existsSync(fullPath)) {
      missing++;
      console.warn(`缺少正文：${item.path}`);
      continue;
    }
    const encoding = detectFileEncoding(fullPath);
    const wordCount = await countFileCharacters(fullPath, encoding);
    if (!dryRun) {
      await prisma.book.updateMany({ where: { filePath: item.path }, data: { wordCount } });
    }
    completed++;
    if (completed <= 5 || completed % 25 === 0 || completed === files.length) {
      console.log(`[${completed}/${files.length}] ${item.books[0].title}：${wordCount.toLocaleString("zh-CN")} 字（${encoding}）`);
    }
  }
  console.log(`${dryRun ? "dry-run " : ""}完成：${completed} 个文件，缺失 ${missing} 个。`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
