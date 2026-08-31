/**
 * 按数据库评分筛选本地小说正文，并生成部署清单或复制到指定目录。
 *
 * 仅生成清单（默认评分 >= 7.5）：
 *   node scripts/export-rated-novels.js
 *
 * 复制正文并保留数据库使用的相对目录结构：
 *   node scripts/export-rated-novels.js --output E:/novels-score-7.5-plus
 *
 * 可选参数：
 *   --min-score 8
 *   --manifest exports/novels-score-8-plus.json
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const minScore = Number(getArg("--min-score") || "7.5");
if (!Number.isFinite(minScore)) {
  throw new Error("--min-score 必须是有效数字");
}

const novelRootValue = process.env.NOVEL_ROOT;
if (!novelRootValue) {
  throw new Error("缺少 NOVEL_ROOT 环境变量，请在 .env 中配置小说根目录");
}

const novelRoot = path.resolve(novelRootValue);
const outputArg = getArg("--output");
const outputRoot = outputArg ? path.resolve(outputArg) : null;
const scoreLabel = String(minScore).replace(/[^0-9.-]/g, "_");
const defaultManifest = path.join(__dirname, "..", "exports", `novels-score-${scoreLabel}-plus.json`);
const manifestPath = path.resolve(getArg("--manifest") || defaultManifest);
const filesPath = manifestPath.replace(/\.json$/i, "-files.txt");
const prisma = new PrismaClient();

function resolveSource(relativePath) {
  const fullPath = path.resolve(novelRoot, relativePath);
  const relative = path.relative(novelRoot, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`正文路径越过 NOVEL_ROOT: ${relativePath}`);
  }
  return fullPath;
}

function copyBook(sourcePath, destinationPath, expectedSize) {
  if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).size === expectedSize) {
    return false;
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return true;
}

async function main() {
  const books = await prisma.book.findMany({
    where: {
      score: { gte: minScore },
      hasContent: true,
      filePath: { not: null },
    },
    select: {
      id: true,
      postId: true,
      title: true,
      author: true,
      score: true,
      size: true,
      filePath: true,
      chapterCount: true,
    },
    orderBy: [{ score: "desc" }, { id: "asc" }],
  });

  const unavailable = await prisma.book.findMany({
    where: {
      score: { gte: minScore },
      OR: [{ hasContent: false }, { filePath: null }],
    },
    select: {
      id: true,
      postId: true,
      title: true,
      author: true,
      score: true,
    },
    orderBy: [{ score: "desc" }, { id: "asc" }],
  });

  const selected = [];
  const missingFiles = [];
  let totalBytes = 0;
  let copiedFiles = 0;
  let copiedBytes = 0;

  for (let index = 0; index < books.length; index++) {
    const book = books[index];
    const sourcePath = resolveSource(book.filePath);
    let stat;
    try {
      stat = fs.statSync(sourcePath);
      if (!stat.isFile()) throw new Error("不是文件");
    } catch {
      missingFiles.push({ ...book, filePath: book.filePath });
      continue;
    }

    totalBytes += stat.size;
    selected.push({
      ...book,
      filePath: book.filePath.replace(/\\/g, "/"),
      bytes: stat.size,
    });

    if (outputRoot) {
      const destinationPath = path.resolve(outputRoot, book.filePath);
      const relativeDestination = path.relative(outputRoot, destinationPath);
      if (relativeDestination.startsWith("..") || path.isAbsolute(relativeDestination)) {
        throw new Error(`导出路径越过目标目录: ${book.filePath}`);
      }
      if (copyBook(sourcePath, destinationPath, stat.size)) {
        copiedFiles++;
        copiedBytes += stat.size;
      }
      if ((index + 1) % 100 === 0 || index + 1 === books.length) {
        console.log(`进度 ${index + 1}/${books.length}`);
      }
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    minScore,
    summary: {
      selectedBooks: selected.length,
      totalBytes,
      totalGiB: Number((totalBytes / 1024 / 1024 / 1024).toFixed(2)),
      metadataWithoutContent: unavailable.length,
      missingFiles: missingFiles.length,
      copiedFiles,
      copiedBytes,
    },
    unavailable,
    missingFiles,
    books: selected,
  };

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  fs.writeFileSync(filesPath, selected.map((book) => book.filePath).join("\n") + "\n", "utf8");

  console.log(`清单: ${manifestPath}`);
  console.log(`文件列表: ${filesPath}`);
  console.log(`符合条件且有正文: ${selected.length}`);
  console.log(`正文总大小: ${manifest.summary.totalGiB} GiB`);
  console.log(`高分但无正文元数据: ${unavailable.length}`);
  console.log(`数据库有路径但文件缺失: ${missingFiles.length}`);
  if (!outputRoot) {
    console.log("未指定 --output，本次只生成清单，没有复制正文。");
  } else {
    console.log(`导出目录: ${outputRoot}`);
    console.log(`本次新复制: ${copiedFiles} 个文件 / ${(copiedBytes / 1024 / 1024 / 1024).toFixed(2)} GiB`);
  }
}

main()
  .catch((error) => {
    console.error("筛选导出失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
