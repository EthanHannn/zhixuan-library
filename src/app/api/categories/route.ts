import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIN_BOOK_SCORE } from "@/lib/catalog";

export async function GET() {
  try {
    const where = { status: "APPROVED", hasContent: true, score: { gte: MIN_BOOK_SCORE } };
    const [groups, subGroups, books, authors, wordStats] = await Promise.all([
      prisma.book.groupBy({ by: ["tag1"], where, _count: { _all: true }, orderBy: { _count: { tag1: "desc" } } }),
      prisma.book.groupBy({ by: ["tag2"], where, _count: { _all: true }, orderBy: { _count: { tag2: "desc" } } }),
      prisma.book.count({ where }),
      prisma.book.findMany({ where, distinct: ["author"], select: { author: true } }),
      prisma.book.aggregate({ where, _min: { wordCount: true }, _max: { wordCount: true } }),
    ]);
    return NextResponse.json({
      categories: groups.map((group) => ({ name: group.tag1, count: group._count._all })),
      subcategories: subGroups.map((group) => ({ name: group.tag2, count: group._count._all })),
      stats: {
        books,
        authors: authors.length,
        categories: groups.length,
        minScore: MIN_BOOK_SCORE,
        minWords: wordStats._min.wordCount || 0,
        maxWords: wordStats._max.wordCount || 0,
      },
    });
  } catch (error) {
    console.error("获取分类失败:", error);
    return NextResponse.json({ error: "获取分类失败" }, { status: 500 });
  }
}
