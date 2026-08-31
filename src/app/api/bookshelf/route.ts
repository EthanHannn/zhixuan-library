import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { MIN_BOOK_SCORE } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

const bookIdSchema = z.coerce.number().int().positive();

async function currentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const bookIdValue = new URL(req.url).searchParams.get("bookId");
    if (bookIdValue) {
      const bookId = bookIdSchema.parse(bookIdValue);
      const entry = await prisma.bookshelfEntry.findUnique({
        where: { userId_bookId: { userId, bookId } },
        select: { id: true, addedAt: true },
      });
      return NextResponse.json({ inBookshelf: !!entry, entry });
    }

    const entries = await prisma.bookshelfEntry.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            tag1: true,
            tag2: true,
            score: true,
            size: true,
            wordCount: true,
            chapterCount: true,
            hasContent: true,
            coverPath: true,
            progress: {
              where: { userId },
              select: { chapterIdx: true, percent: true, updatedAt: true },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json({
      count: entries.length,
      entries: entries.map(({ book, ...entry }) => ({
        ...entry,
        book: { ...book, progress: book.progress[0] || null },
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
    console.error("获取书架失败:", error);
    return NextResponse.json({ error: "获取书架失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const { bookId: rawBookId } = await req.json();
    const bookId = bookIdSchema.parse(rawBookId);
    const book = await prisma.book.findFirst({
      where: { id: bookId, status: "APPROVED", hasContent: true, score: { gte: MIN_BOOK_SCORE } },
      select: { id: true },
    });
    if (!book) return NextResponse.json({ error: "书籍不存在或暂无正文" }, { status: 404 });

    const entry = await prisma.bookshelfEntry.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { updatedAt: new Date() },
      create: { userId, bookId },
      select: { id: true, bookId: true, addedAt: true },
    });
    return NextResponse.json({ success: true, inBookshelf: true, entry });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
    console.error("加入书架失败:", error);
    return NextResponse.json({ error: "加入书架失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const bookId = bookIdSchema.parse(new URL(req.url).searchParams.get("bookId"));
    await prisma.bookshelfEntry.deleteMany({ where: { userId, bookId } });
    return NextResponse.json({ success: true, inBookshelf: false });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
    console.error("移出书架失败:", error);
    return NextResponse.json({ error: "移出书架失败" }, { status: 500 });
  }
}
