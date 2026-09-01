"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookCard } from "@/components/BookCard";
import { BookCover } from "@/components/BookCover";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { SiteHeader } from "@/components/SiteHeader";
import { formatReadingPosition } from "@/lib/format";
import type { BookSummary } from "@/types/catalog";

interface CatalogStats {
  books: number;
  authors: number;
  categories: number;
  minScore: number;
}

interface ReadingEntry {
  chapterIdx: number;
  percent: number;
  updatedAt: string;
  book: {
    id: number;
    title: string;
    author: string;
    chapterCount: number;
    coverPath: string | null;
  };
}

const EMPTY_STATS: CatalogStats = { books: 0, authors: 0, categories: 0, minScore: 7.5 };

export default function Home() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<CatalogStats>(EMPTY_STATS);
  const [banners, setBanners] = useState<BookSummary[]>([]);
  const [featured, setFeatured] = useState<BookSummary[]>([]);
  const [latest, setLatest] = useState<BookSummary[]>([]);
  const [reading, setReading] = useState<ReadingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((response) => response.json()),
      fetch("/api/books?limit=5&onlyContent=1&sortBy=popularity").then((response) => response.json()),
      fetch("/api/books?limit=6&onlyContent=1&sortBy=score").then((response) => response.json()),
      fetch("/api/books?limit=6&onlyContent=1&sortBy=latest").then((response) => response.json()),
      fetch("/api/progress").then((response) => response.ok ? response.json() : { progress: [] }),
    ]).then(([categoryData, bannerData, featuredData, latestData, progressData]) => {
      setStats(categoryData.stats || EMPTY_STATS);
      setBanners(bannerData.books || []);
      setFeatured(featuredData.books || []);
      setLatest(latestData.books || []);
      setReading((progressData.progress || []).slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main>
        <FeaturedCarousel books={banners.length > 0 ? banners : featured} stats={stats} nickname={session?.user?.nickname} />

        {reading.length > 0 && <section className="border-b border-[#ddd4c5] bg-[#fffdf8]"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">CONTINUE READING</p><h2 className="mt-2 font-serif text-3xl font-bold text-[#263e35]">接着上次读</h2></div><Link href="/bookshelf" className="text-sm font-semibold text-[#9b4b35] hover:underline">全部阅读记录 →</Link></div><div className="mt-6 grid gap-4 lg:grid-cols-3">{reading.map((item) => <Link key={item.book.id} href={`/read/${item.book.id}?c=${item.chapterIdx}`} className="group flex items-center gap-4 rounded-2xl border border-[#ded5c6] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg"><BookCover id={item.book.id} title={item.book.title} coverPath={item.book.coverPath} className="h-20 w-14 shrink-0 rounded-lg object-cover shadow" sizes="56px" /><div className="min-w-0"><h3 className="line-clamp-1 font-serif text-lg font-bold text-[#2c4037] group-hover:text-[#994b35]">{item.book.title}</h3><p className="mt-1 line-clamp-1 text-sm font-medium text-[#6c655b]">{item.book.author}</p><p className="mt-2 text-xs font-semibold text-[#a6533b]">{formatReadingPosition(item.chapterIdx, item.percent)} · 继续阅读 →</p></div></Link>)}</div></div></section>}

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.28em] text-[#a14f37]">HIGHLY RATED</p><h2 className="mt-3 font-serif text-4xl font-bold text-[#263e35]">高分精选</h2><p className="mt-3 text-sm font-medium text-[#6d665c]">从书库里挑出的高评分作品</p></div><Link href="/library?sortBy=score" className="w-fit rounded-full border border-[#b9ab97] px-5 py-2.5 text-sm font-semibold text-[#3c574c] hover:border-[#315f50] hover:bg-[#315f50] hover:text-white">查看全部高分作品</Link></div>
          {loading ? <div className="py-24 text-center font-medium text-[#716a60]">正在翻找书架…</div> : <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{featured.map((book) => <BookCard key={book.id} book={book} />)}</div>}
        </section>

        <section className="border-t border-[#ddd4c5] bg-[#eee8dc]/65"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.28em] text-[#a14f37]">NEW TO THE LIBRARY</p><h2 className="mt-3 font-serif text-4xl font-bold text-[#263e35]">最近入库</h2></div><Link href="/library?sortBy=latest" className="text-sm font-semibold text-[#9b4b35] hover:underline">查看更多新书 →</Link></div><div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{latest.map((book) => <BookCard key={book.id} book={book} />)}</div></div></section>
      </main>
      <footer className="bg-[#203c33] px-4 py-10 text-center text-sm font-medium text-white/55">知轩书房 · 私人高分藏书空间</footer>
    </div>
  );
}
