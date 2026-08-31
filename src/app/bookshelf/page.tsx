"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { SiteHeader } from "@/components/SiteHeader";
import { formatReadingPosition, formatWordCount } from "@/lib/format";

interface Progress {
  chapterIdx: number;
  percent: number;
  updatedAt: string;
}

interface ShelfEntry {
  id: string;
  addedAt: string;
  book: {
    id: number;
    title: string;
    author: string;
    tag1: string;
    tag2: string;
    score: number;
    size: string;
    wordCount: number;
    chapterCount: number;
    hasContent: boolean;
    coverPath: string | null;
    progress: Progress | null;
  };
}

interface ReadingEntry extends Progress {
  book: {
    id: number;
    title: string;
    author: string;
    tag1: string;
    wordCount: number;
    chapterCount: number;
    hasContent: boolean;
    coverPath: string | null;
  };
}

function progressPercent(progress: Progress | null, chapterCount: number) {
  if (!progress || chapterCount <= 0) return 0;
  return Math.min(100, Math.max(0, ((progress.chapterIdx - 1 + progress.percent) / chapterCount) * 100));
}

export default function BookshelfPage() {
  const [entries, setEntries] = useState<ShelfEntry[]>([]);
  const [reading, setReading] = useState<ReadingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shelfResponse, progressResponse] = await Promise.all([fetch("/api/bookshelf"), fetch("/api/progress")]);
      const [shelfData, progressData] = await Promise.all([shelfResponse.json(), progressResponse.json()]);
      setEntries(shelfData.entries || []);
      setReading(progressData.progress || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeBook = async (bookId: number) => {
    setRemoving(bookId);
    try {
      const response = await fetch(`/api/bookshelf?bookId=${bookId}`, { method: "DELETE" });
      if (response.ok) setEntries((current) => current.filter((entry) => entry.book.id !== bookId));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <section className="overflow-hidden rounded-[2rem] border border-[#d4cab9] bg-[#294e42] px-6 py-9 text-white shadow-[0_22px_60px_rgba(41,78,66,0.18)] sm:px-9">
          <p className="text-xs font-semibold tracking-[0.3em] text-[#efb69d]">YOUR READING SHELF</p>
          <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div><h1 className="font-serif text-4xl font-bold sm:text-5xl">我的书架</h1><p className="mt-3 max-w-xl leading-7 text-white/75">收藏想读的作品，阅读进度会自动保留。下次回来，从停下的那一章继续。</p></div>
            <div className="flex gap-8 text-sm text-white/65"><span><b className="mr-2 font-serif text-3xl text-white">{entries.length}</b>本收藏</span><span><b className="mr-2 font-serif text-3xl text-white">{reading.length}</b>本读过</span></div>
          </div>
        </section>

        {loading ? <div className="py-24 text-center font-medium text-[#6d665c]">正在整理书架…</div> : (
          <>
            <section className="mt-10">
              <div className="flex items-end justify-between"><div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">COLLECTION</p><h2 className="mt-2 font-serif text-3xl font-bold text-[#263e35]">已加入的书</h2></div><Link href="/library" className="text-sm font-semibold text-[#9b4b35] hover:underline">去书库找书 →</Link></div>
              {entries.length === 0 ? (
                <div className="mt-7 rounded-[1.75rem] border border-dashed border-[#c9beac] bg-[#fffdf8] px-6 py-16 text-center"><h3 className="font-serif text-2xl font-bold text-[#2f443b]">书架还是空的</h3><p className="mt-3 text-[#6d665c]">在书籍详情页点击“加入书架”，以后就能从这里继续阅读。</p><Link href="/library" className="mt-6 inline-flex rounded-xl bg-[#315f50] px-6 py-3 font-semibold text-white">逛逛书库</Link></div>
              ) : (
                <div className="mt-7 grid gap-5 lg:grid-cols-2">
                  {entries.map((entry) => {
                    const { book } = entry;
                    const completion = progressPercent(book.progress, book.chapterCount);
                    const readHref = `/read/${book.id}${book.progress ? `?c=${book.progress.chapterIdx}` : ""}`;
                    return <article key={entry.id} className="flex gap-4 rounded-[1.5rem] border border-[#ddd3c2] bg-[#fffdf8] p-4 shadow-[0_14px_40px_rgba(55,45,35,0.06)] sm:gap-5 sm:p-5">
                      <Link href={`/book/${book.id}`} className="w-24 shrink-0 overflow-hidden rounded-xl bg-[#e4dccd] shadow-md sm:w-28"><BookCover id={book.id} title={book.title} coverPath={book.coverPath} className="aspect-[5/7] h-full w-full object-cover" sizes="112px" /></Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/book/${book.id}`} className="line-clamp-2 font-serif text-xl font-bold leading-7 text-[#263e35] hover:text-[#994b35]">{book.title}</Link><Link href={`/author/${encodeURIComponent(book.author)}`} className="mt-1.5 block w-fit text-sm font-medium text-[#665f56] hover:text-[#994b35]">{book.author}</Link></div><span className="rounded-full bg-[#eef1e9] px-2.5 py-1 text-xs font-bold text-[#3d6657]">{book.score.toFixed(1)}</span></div>
                        <p className="mt-3 text-xs font-medium text-[#756e63]">{book.chapterCount.toLocaleString("zh-CN")} 章 · {formatWordCount(book.wordCount, book.size)} · {book.tag2}</p>
                        <div className="mt-auto pt-4"><div className="mb-2 flex justify-between text-xs font-medium text-[#71695f]"><span>{book.progress ? formatReadingPosition(book.progress.chapterIdx, book.progress.percent) : "尚未开始"}</span><span>{Math.round(completion)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e6dfd3]"><div className="h-full rounded-full bg-[#b15b40]" style={{ width: `${completion}%` }} /></div><div className="mt-4 flex items-center gap-2"><Link href={readHref} className="flex-1 rounded-xl bg-[#315f50] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#284e42]">{book.progress ? "继续阅读" : "开始阅读"}</Link><button disabled={removing === book.id} onClick={() => removeBook(book.id)} className="rounded-xl border border-[#d5cabb] px-3 py-2.5 text-sm font-medium text-[#71695f] hover:border-[#a9553d] hover:text-[#994b35] disabled:opacity-50">移出</button></div></div>
                      </div>
                    </article>;
                  })}
                </div>
              )}
            </section>

            <section className="mt-14 pb-8">
              <div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">READING HISTORY</p><h2 className="mt-2 font-serif text-3xl font-bold text-[#263e35]">阅读足迹</h2><p className="mt-2 text-sm font-medium text-[#6d665c]">最近阅读的作品会自动记录，不要求先加入书架。</p></div>
              {reading.length === 0 ? <div className="mt-6 rounded-2xl border border-[#ddd3c2] bg-[#fffdf8] p-10 text-center text-[#6d665c]">还没有阅读记录。</div> : <div className="mt-6 divide-y divide-[#e3dbce] overflow-hidden rounded-[1.5rem] border border-[#ddd3c2] bg-[#fffdf8]">{reading.map((item) => <div key={item.book.id} className="flex items-center gap-4 p-4 sm:px-5"><BookCover id={item.book.id} title={item.book.title} coverPath={item.book.coverPath} className="h-16 w-12 shrink-0 rounded-md object-cover shadow" sizes="48px" /><div className="min-w-0 flex-1"><Link href={`/book/${item.book.id}`} className="line-clamp-1 font-serif text-lg font-bold text-[#2d4038] hover:text-[#994b35]">{item.book.title}</Link><p className="mt-1 line-clamp-1 text-sm font-medium text-[#6d665c]">{item.book.author} · {formatReadingPosition(item.chapterIdx, item.percent)} · {new Date(item.updatedAt).toLocaleDateString("zh-CN")}</p></div>{item.book.hasContent && <Link href={`/read/${item.book.id}?c=${item.chapterIdx}`} className="shrink-0 rounded-full border border-[#315f50] px-4 py-2 text-sm font-semibold text-[#315f50] hover:bg-[#315f50] hover:text-white">继续</Link>}</div>)}</div>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
