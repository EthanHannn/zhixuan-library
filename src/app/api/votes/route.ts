import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const voteSchema = z.object({
  bookId: z.number(),
  type: z.enum(["XIANCAO", "LIANGCAO", "GANCAO", "KUCAO", "DUCAO"])
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const { bookId, type } = voteSchema.parse(body);

    // 检查是否已投票
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_bookId: {
          userId: (session.user as any).id,
          bookId
        }
      }
    });

    if (existingVote) {
      return NextResponse.json({ error: "已投过票" }, { status: 400 });
    }

    // 创建投票
    const vote = await prisma.vote.create({
      data: {
        userId: (session.user as any).id,
        bookId,
        type
      }
    });

    // 更新书籍统计
    const fieldMap: Record<string, string> = {
      XIANCAO: "xiancaoCount",
      LIANGCAO: "liangcaoCount",
      GANCAO: "gancaoCount",
      KUCAO: "kucaoCount",
      DUCAO: "ducaoCount"
    };

    await prisma.book.update({
      where: { id: bookId },
      data: {
        [fieldMap[type]]: { increment: 1 }
      }
    });

    // 重新计算评分
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        xiancaoCount: true,
        liangcaoCount: true,
        gancaoCount: true,
        kucaoCount: true,
        ducaoCount: true
      }
    });

    if (book) {
      const totalVotes = book.xiancaoCount + book.liangcaoCount + book.gancaoCount + book.kucaoCount + book.ducaoCount;
      const totalScore = book.xiancaoCount * 10 + book.liangcaoCount * 7 + book.gancaoCount * 5 + book.kucaoCount * 3 + book.ducaoCount * 1;
      const score = totalVotes > 0 ? totalScore / totalVotes : 0;

      await prisma.book.update({
        where: { id: bookId },
        data: {
          totalScore,
          score,
          popularity: totalVotes
        }
      });
    }

    return NextResponse.json({ success: true, vote });
  } catch (error) {
    console.error("投票失败:", error);
    return NextResponse.json({ error: "投票失败" }, { status: 500 });
  }
}

// 获取用户的投票记录
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");

    if (bookId) {
      // 获取单本书的投票
      const vote = await prisma.vote.findUnique({
        where: {
          userId_bookId: {
            userId: (session.user as any).id,
            bookId: parseInt(bookId)
          }
        }
      });
      return NextResponse.json({ vote });
    } else {
      // 获取用户所有投票
      const votes = await prisma.vote.findMany({
        where: {
          userId: (session.user as any).id
        },
        include: {
          book: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });
      return NextResponse.json({ votes });
    }
  } catch (error) {
    console.error("获取投票失败:", error);
    return NextResponse.json({ error: "获取投票失败" }, { status: 500 });
  }
}
