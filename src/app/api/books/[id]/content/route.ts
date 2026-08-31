import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readChapterContent } from "@/lib/novel";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookId = parseInt(id);
    if (isNaN(bookId)) {
      return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const chapterIdx = parseInt(searchParams.get("chapter") || "1");

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
    }
    if (!book.filePath || !book.hasContent) {
      return NextResponse.json({ error: "本书暂无本地正文" }, { status: 404 });
    }

    const chapter = await prisma.chapter.findFirst({
      where: { bookId, idx: chapterIdx },
    });
    if (!chapter) {
      return NextResponse.json({ error: "章节不存在" }, { status: 404 });
    }

    const { title, content } = readChapterContent(book, chapter);
    return NextResponse.json({
      idx: chapter.idx,
      title,
      content,
      total: book.chapterCount,
      hasPrev: chapter.idx > 1,
      hasNext: chapter.idx < book.chapterCount,
    });
  } catch (error) {
    console.error("读取章节失败:", error);
    return NextResponse.json({ error: "读取章节失败" }, { status: 500 });
  }
}
