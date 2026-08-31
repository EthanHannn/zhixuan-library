"use client";

import { useCallback, useEffect, useState } from "react";
import { BookCard } from "./BookCard";
import type { BookSummary } from "@/types/catalog";

interface BookCollectionProps {
  title: string;
  eyebrow?: string;
  description?: string;
  author?: string;
  tag?: string;
}

export function BookCollection({ title, eyebrow = "CURATED COLLECTION", description, author, tag }: BookCollectionProps) {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "24", onlyContent: "1" });
    if (author) params.set("author", author);
    if (tag) params.set("tag", tag);
    try {
      const response = await fetch(`/api/books?${params}`);
      const data = await response.json();
      setBooks(data.books || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [author, page, tag]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
      <p className="text-xs font-semibold tracking-[0.28em] text-[#a14f37]">{eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl font-bold text-[#263e35] sm:text-5xl">{title}</h1>
      {description && <p className="mt-4 max-w-2xl font-medium leading-7 text-[#665f56]">{description}</p>}

      {loading ? (
        <div className="py-24 text-center font-medium text-[#716a60]">正在翻找书架…</div>
      ) : books.length ? (
        <>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{books.map((book) => <BookCard key={book.id} book={book} />)}</div>
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-full border border-[#d8d0c0] bg-white px-5 py-2 text-sm disabled:opacity-40">上一页</button>
              <span className="text-sm font-medium text-[#625c53]">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-full border border-[#d8d0c0] bg-white px-5 py-2 text-sm disabled:opacity-40">下一页</button>
            </div>
          )}
        </>
      ) : <div className="mt-10 rounded-2xl border border-dashed border-[#c9beac] bg-[#fffdf8]/60 p-16 text-center font-medium text-[#6d665c]">这里暂时没有符合条件的作品</div>}
    </main>
  );
}
