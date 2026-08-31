import fs from "fs";
import path from "path";
import type { Book, Chapter } from "@prisma/client";

function getNovelRoot(): string {
  const novelRoot = process.env.NOVEL_ROOT;
  if (!novelRoot) {
    throw new Error("缺少 NOVEL_ROOT 环境变量，请在 .env 中配置小说根目录");
  }
  return novelRoot;
}

// 简单 LRU 缓冲：缓存最近读取的 TXT 原始 Buffer，总容量上限
const cache = new Map<string, { buf: Buffer; size: number; last: number }>();
const MAX_CACHE_BYTES = 160 * 1024 * 1024; // 160MB
let cacheBytes = 0;

function getBuffer(filePath: string): Buffer {
  const full = path.join(getNovelRoot(), filePath);
  const hit = cache.get(full);
  if (hit) {
    hit.last = Date.now();
    return hit.buf;
  }
  const buf = fs.readFileSync(full);
  cacheBytes += buf.length;
  cache.set(full, { buf, size: buf.length, last: Date.now() });
  while (cacheBytes > MAX_CACHE_BYTES && cache.size > 1) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of cache) {
      if (v.last < oldestTime) {
        oldest = k;
        oldestTime = v.last;
      }
    }
    if (oldest) {
      const v = cache.get(oldest)!;
      cacheBytes -= v.size;
      cache.delete(oldest);
    }
  }
  return buf;
}

function detectEncoding(buf: Buffer): "utf-8" | "gb18030" {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, 8192));
    return "utf-8";
  } catch {
    return "gb18030";
  }
}

/**
 * 读取某一章正文。章节起止偏移都是行首（字符边界），
 * 因此直接对字节区间做 GB18030/UTF-8 解码即可。
 */
export function readChapterContent(
  book: Book,
  chapter: Chapter
): { title: string; content: string } {
  if (!book.filePath) {
    throw new Error("本书无本地正文文件");
  }
  const buf = getBuffer(book.filePath);
  const encoding = detectEncoding(buf);
  const start = Math.max(0, chapter.startOffset);
  const end = Math.min(buf.length, chapter.endOffset);
  const slice = buf.subarray(start, end);
  const text = new TextDecoder(encoding).decode(slice);
  let content = text.replace(/^\s*\r?\n+/, "").replace(/\r?\n+$/, "");
  // 去掉与章节标题重复的首行（导入时 startOffset 指向标题行行首）
  const firstLine = content.split(/\r?\n/, 1)[0].trim();
  if (firstLine && firstLine === chapter.title.trim()) {
    content = content.slice(content.indexOf("\n") + 1);
  }
  // 统一去掉段落行首的全角空格缩进（交给 CSS text-indent 控制）
  content = content.replace(/^[\s\u3000]+/gm, "");
  return { title: chapter.title, content };
}
