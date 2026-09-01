import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIN_BOOK_SCORE } from "@/lib/catalog";

const recommendationSelect = {
  id: true,
  title: true,
  author: true,
  tag1: true,
  tag2: true,
  score: true,
  xiancaoCount: true,
  ducaoCount: true,
  size: true,
  intro: true,
  popularity: true,
  hasContent: true,
  chapterCount: true,
  wordCount: true,
  coverPath: true,
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number.parseInt(id, 10);
  const requestedLimit = Number.parseInt(new URL(request.url).searchParams.get("limit") || "6", 10);
  const limit = Math.min(12, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 6));

  if (!Number.isFinite(bookId)) {
    return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
  }

  const source = await prisma.book.findFirst({
    where: { id: bookId, status: "APPROVED", score: { gte: MIN_BOOK_SCORE } },
    select: { id: true, author: true, tag1: true, tag2: true, wordCount: true },
  });

  if (!source) {
    return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
  }

  const candidates = await prisma.book.findMany({
    where: {
      id: { not: source.id },
      status: "APPROVED",
      hasContent: true,
      score: { gte: MIN_BOOK_SCORE },
      OR: [
        { author: source.author },
        { tag1: source.tag1 },
        { tag2: source.tag2 },
      ],
    },
    select: recommendationSelect,
    orderBy: [{ score: "desc" }, { popularity: "desc" }],
    take: 80,
  });

  const ranked = candidates
    .map((book) => {
      const sameAuthor = book.author === source.author ? 5 : 0;
      const samePrimaryTag = book.tag1 === source.tag1 ? 4 : 0;
      const sameSecondaryTag = book.tag2 === source.tag2 ? 3 : 0;
      const lengthRatio = source.wordCount > 0 && book.wordCount > 0
        ? Math.min(source.wordCount, book.wordCount) / Math.max(source.wordCount, book.wordCount)
        : 0;
      return {
        book,
        rank: sameAuthor + samePrimaryTag + sameSecondaryTag + lengthRatio * 1.5 + book.score / 10 + Math.random() * 1.8,
      };
    })
    .sort((left, right) => right.rank - left.rank)
    .slice(0, limit)
    .map(({ book }) => book);

  if (ranked.length < limit) {
    const existingIds = [source.id, ...ranked.map((book) => book.id)];
    const fallback = await prisma.book.findMany({
      where: {
        id: { notIn: existingIds },
        status: "APPROVED",
        hasContent: true,
        score: { gte: MIN_BOOK_SCORE },
      },
      select: recommendationSelect,
      orderBy: [{ score: "desc" }, { popularity: "desc" }],
      take: limit - ranked.length,
    });
    ranked.push(...fallback);
  }

  return NextResponse.json(
    { books: ranked },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
