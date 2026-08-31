import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MIN_BOOK_SCORE } from "@/lib/catalog";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const bookSchema = z.object({
  title: z.string().min(1, "书名不能为空"),
  author: z.string().min(1, "作者不能为空"),
  tag1: z.string().min(1, "标签1不能为空"),
  tag2: z.string().min(1, "标签2不能为空"),
  size: z.string().min(1, "字数不能为空"),
  intro: z.string().min(1, "简介不能为空")
});

// 获取书籍列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get("sortBy") || "score";
    const status = searchParams.get("status") || "APPROVED";
    const search = searchParams.get("search") || "";
    const author = searchParams.get("author") || "";
    const tag = searchParams.get("tag") || "";
    const tag1 = searchParams.get("tag1") || "";
    const tag2 = searchParams.get("tag2") || "";
    const onlyContent = searchParams.get("onlyContent") === "1";
    const requestedMinScore = Number(searchParams.get("minScore") || MIN_BOOK_SCORE);
    const requestedMaxScore = Number(searchParams.get("maxScore") || "10");
    const minScore = Math.min(10, Math.max(MIN_BOOK_SCORE, Number.isFinite(requestedMinScore) ? requestedMinScore : MIN_BOOK_SCORE));
    const maxScore = Math.min(10, Math.max(minScore, Number.isFinite(requestedMaxScore) ? requestedMaxScore : 10));
    const minWords = Math.max(0, parseInt(searchParams.get("minWords") || "0") || 0);
    const maxWordsValue = parseInt(searchParams.get("maxWords") || "0") || 0;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Prisma.BookWhereInput = {
      status,
      score: { gte: minScore, lte: maxScore },
    };

    if (onlyContent) {
      where.hasContent = true;
    }

    const filters: Prisma.BookWhereInput[] = [];
    if (search) filters.push({ OR: [{ title: { contains: search } }, { author: { contains: search } }] });
    if (author) where.author = author;
    if (tag1) where.tag1 = tag1;
    if (tag2) where.tag2 = tag2;
    if (tag) filters.push({ OR: [{ tag1: tag }, { tag2: tag }] });
    if (minWords > 0 || maxWordsValue > 0) {
      where.wordCount = {
        ...(minWords > 0 ? { gte: minWords } : {}),
        ...(maxWordsValue > 0 ? { lte: Math.max(minWords, maxWordsValue) } : {}),
      };
    }
    if (filters.length) where.AND = filters;

    let orderBy: Prisma.BookOrderByWithRelationInput = { score: "desc" };
    if (sortBy === "score") {
      orderBy = { score: "desc" };
    } else if (sortBy === "xiancao") {
      orderBy = { xiancaoCount: "desc" };
    } else if (sortBy === "popularity") {
      orderBy = { popularity: "desc" };
    } else if (sortBy === "latest") {
      orderBy = { createdAt: "desc" };
    } else if (sortBy === "words") {
      orderBy = { wordCount: "desc" };
    } else if (sortBy === "title") {
      orderBy = { title: "asc" };
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              comments: true,
              votes: true
            }
          }
        }
      }),
      prisma.book.count({ where })
    ]);

    return NextResponse.json({
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("获取书籍列表失败:", error);
    return NextResponse.json({ error: "获取书籍列表失败" }, { status: 500 });
  }
}

// 提交新书
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const data = bookSchema.parse(body);

    const book = await prisma.book.create({
      data: {
        ...data,
        submittedById: session.user.id,
        status: "PENDING"  // 需要管理员审核
      }
    });

    return NextResponse.json({ success: true, book });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("提交书籍失败:", error);
    return NextResponse.json({ error: "提交书籍失败" }, { status: 500 });
  }
}
