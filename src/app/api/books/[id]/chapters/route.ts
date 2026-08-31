import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, title: true, author: true, hasContent: true, chapterCount: true },
    });
    if (!book) {
      return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
    }

    const chapters = await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { idx: "asc" },
      select: { idx: true, title: true },
    });

    return NextResponse.json({
      book,
      chapters,
    });
  } catch (error) {
    console.error("获取章节列表失败:", error);
    return NextResponse.json({ error: "获取章节列表失败" }, { status: 500 });
  }
}
