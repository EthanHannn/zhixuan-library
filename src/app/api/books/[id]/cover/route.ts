import { after, NextResponse } from "next/server";
import { queueBookCoverFetch } from "@/lib/cover-fetcher";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number.parseInt(id, 10);
  if (!Number.isFinite(bookId)) {
    return NextResponse.json({ error: "无效的书籍ID" }, { status: 400 });
  }

  const { status, completion } = queueBookCoverFetch(bookId);
  if (completion) after(() => completion);

  return NextResponse.json(
    { status },
    { status: status === "busy" ? 503 : 202, headers: { "Cache-Control": "no-store" } },
  );
}
