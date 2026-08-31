import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 获取阅读进度（需登录）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const { id } = await params;
    const bookId = parseInt(id);
    if (isNaN(bookId)) {
      return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
    }
    const userId = session.user.id;

    const progress = await prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("获取阅读进度失败:", error);
    return NextResponse.json({ error: "获取阅读进度失败" }, { status: 500 });
  }
}

// 保存阅读进度（需登录）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const { id } = await params;
    const bookId = parseInt(id);
    if (isNaN(bookId)) {
      return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
    }
    const body = await req.json();
    const chapterIdx = Math.max(1, parseInt(body.chapterIdx) || 1);
    const percent = Math.min(1, Math.max(0, parseFloat(body.percent) || 0));

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
    }

    const userId = session.user.id;
    const progress = await prisma.readingProgress.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { chapterIdx, percent },
      create: { userId, bookId, chapterIdx, percent },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("保存阅读进度失败:", error);
    return NextResponse.json({ error: "保存阅读进度失败" }, { status: 500 });
  }
}
