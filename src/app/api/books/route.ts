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
    const onlyContent = searchParams.get("onlyContent") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Prisma.BookWhereInput = {
      status,
      score: { gte: MIN_BOOK_SCORE },
    };

    if (onlyContent) {
      where.hasContent = true;
    }

    const filters: Prisma.BookWhereInput[] = [];
    if (search) filters.push({ OR: [{ title: { contains: search } }, { author: { contains: search } }] });
    if (author) where.author = author;
    if (tag) filters.push({ OR: [{ tag1: tag }, { tag2: tag }] });
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
