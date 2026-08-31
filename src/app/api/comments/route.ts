import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const commentSchema = z.object({
  bookId: z.number(),
  content: z.string().min(1, "评论不能为空").max(1000, "评论最多1000字"),
  parentId: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const { bookId, content, parentId } = commentSchema.parse(body);

    const comment = await prisma.comment.create({
      data: {
        userId: (session.user as any).id,
        bookId,
        content,
        parentId
      },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("评论失败:", error);
    return NextResponse.json({ error: "评论失败" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");

    if (!bookId) {
      return NextResponse.json({ error: "缺少bookId" }, { status: 400 });
    }

    const comments = await prisma.comment.findMany({
      where: {
        bookId: parseInt(bookId),
        parentId: null  // 只获取顶级评论
      },
      include: {
        user: {
          select: {
            username: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                username: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("获取评论失败:", error);
    return NextResponse.json({ error: "获取评论失败" }, { status: 500 });
  }
}
