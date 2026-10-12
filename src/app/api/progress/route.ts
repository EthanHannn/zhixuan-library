import { getCurrentReader, rejectUnauthorizedRequest } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 获取当前用户的最近阅读列表（需登录）
export async function GET() {
  const denied = await rejectUnauthorizedRequest("GET");
  if (denied) return denied;
  try {
    const reader = await getCurrentReader();
    if (!reader?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = reader.user.id;

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
            wordCount: true,
            coverPath: true,
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
