"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookCard } from "@/components/BookCard";
import { BookCover } from "@/components/BookCover";
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
  const router = useRouter();
  const { data: session } = useSession();
  const [stats, setStats] = useState<CatalogStats>(EMPTY_STATS);
  const [featured, setFeatured] = useState<BookSummary[]>([]);
  const [latest, setLatest] = useState<BookSummary[]>([]);
  const [reading, setReading] = useState<ReadingEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((response) => response.json()),
      fetch("/api/books?limit=6&onlyContent=1&sortBy=score").then((response) => response.json()),
      fetch("/api/books?limit=6&onlyContent=1&sortBy=latest").then((response) => response.json()),
      fetch("/api/progress").then((response) => response.ok ? response.json() : { progress: [] }),
    ]).then(([categoryData, featuredData, latestData, progressData]) => {
      setStats(categoryData.stats || EMPTY_STATS);
      setFeatured(featuredData.books || []);
      setLatest(latestData.books || []);
      setReading((progressData.progress || []).slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    router.push(query.trim() ? `/library?search=${encodeURIComponent(query.trim())}` : "/library");
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-[#294e42] text-white">
          <div className="absolute -right-20 top-10 hidden h-[420px] w-[420px] rounded-full border border-white/10 lg:block" />
          <div className="absolute -right-6 top-24 hidden h-[300px] w-[300px] rounded-full border border-white/10 lg:block" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:py-28">
            <div>
              <p className="text-xs font-semibold tracking-[0.35em] text-[#efb69d]">A PRIVATE READING ROOM</p>
              <h1 className="mt-6 max-w-3xl font-serif text-5xl font-bold leading-[1.12] sm:text-6xl lg:text-7xl">把值得重读的故事，<br /><span className="text-[#f1d6a8]">留在自己的书房。</span></h1>
              <p className="mt-7 max-w-2xl text-base font-medium leading-8 text-white/75 sm:text-lg">{session?.user?.nickname ? `${session.user.nickname}，` : ""}这里收录评分 {stats.minScore} 以上的完整作品。去书库精确筛选，或从书架接着上次读到的地方。</p>
              <form onSubmit={submitSearch} className="mt-9 flex max-w-xl rounded-2xl bg-white p-1.5 shadow-2xl shadow-black/15">
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[#302d28] outline-none placeholder:text-[#8a8277]" placeholder="搜索书名或作者" />
                <button className="rounded-xl bg-[#ad573d] px-5 py-3 font-semibold text-white transition hover:bg-[#994a34] sm:px-6">搜索书库</button>
              </form>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-white/65">
                <span><b className="mr-2 font-serif text-xl text-white">{stats.books.toLocaleString("zh-CN")}</b>本精选</span>
                <span><b className="mr-2 font-serif text-xl text-white">{stats.authors.toLocaleString("zh-CN")}</b>位作者</span>
                <span><b className="mr-2 font-serif text-xl text-white">{stats.categories}</b>个门类</span>
              </div>
              <div className="mt-9 flex flex-wrap gap-3"><Link href="/library" className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20">浏览完整书库</Link><Link href="/bookshelf" className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10">打开我的书架</Link></div>
            </div>
            <div className="relative hidden min-h-[430px] lg:block" aria-hidden="true">
              <div className="absolute left-16 top-0 h-[350px] w-[245px] rotate-[-8deg] rounded-[1.8rem] border border-white/20 bg-[#e8d6b4] p-5 text-[#294e42] shadow-2xl"><div className="flex h-full flex-col rounded-2xl border border-[#294e42]/20 p-6"><span className="text-xs tracking-[0.3em]">知轩藏书</span><span className="mt-auto font-serif text-4xl font-bold leading-tight">好书不必<br />匆匆读完</span><span className="mt-5 text-sm font-medium">私人高分典藏</span></div></div>
              <div className="absolute bottom-4 right-8 h-[330px] w-[230px] rotate-[9deg] rounded-[1.8rem] border border-white/20 bg-[#a9553d] p-5 shadow-2xl"><div className="flex h-full flex-col rounded-2xl border border-white/25 p-6"><span className="text-xs tracking-[0.3em] text-white/70">NIGHT READING</span><span className="mt-auto font-serif text-4xl font-bold leading-tight">今夜，<br />读到哪一章？</span></div></div>
            </div>
          </div>
        </section>

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
