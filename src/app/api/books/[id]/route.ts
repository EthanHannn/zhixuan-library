import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIN_BOOK_SCORE } from "@/lib/catalog";

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

    const book = await prisma.book.findFirst({
      where: { id: bookId, score: { gte: MIN_BOOK_SCORE } },
      include: {
        submittedBy: {
          select: {
            username: true,
            nickname: true,
          }
        },
        _count: {
          select: {
            comments: true,
            votes: true
          }
        }
      }
    });

    if (!book) {
      return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch (error) {
    console.error("获取书籍详情失败:", error);
    return NextResponse.json({ error: "获取书籍详情失败" }, { status: 500 });
  }
}
