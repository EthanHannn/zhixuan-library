import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 获取当前用户的最近阅读列表（需登录）
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const progress = await prisma.readingProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            tag1: true,
            hasContent: true,
            chapterCount: true,
          },
        },
      },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("获取最近阅读失败:", error);
    return NextResponse.json({ error: "获取最近阅读失败" }, { status: 500 });
  }
}
