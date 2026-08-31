"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BookCard } from "@/components/BookCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getCategoryMeta } from "@/lib/catalog";
import type { BookSummary, CategorySummary } from "@/types/catalog";

interface CatalogStats {
  books: number;
  authors: number;
  categories: number;
  minScore: number;
}

const EMPTY_STATS: CatalogStats = { books: 0, authors: 0, categories: 0, minScore: 7.5 };

export default function Home() {
  const { data: session } = useSession();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [stats, setStats] = useState<CatalogStats>(EMPTY_STATS);
  const [queryInput, setQueryInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/categories");
    if (!response.ok) return;
    const data = await response.json();
    setCategories(data.categories || []);
    setStats(data.stats || EMPTY_STATS);
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sortBy, search, page: String(page), limit: "24", onlyContent: "1" });
    try {
      const response = await fetch(`/api/books?${params}`);
      const data = await response.json();
      setBooks(data.books || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadBooks(); }, [loadBooks]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(queryInput.trim());
    requestAnimationFrame(() => document.getElementById("library")?.scrollIntoView({ behavior: "smooth" }));
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-stone-800">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-[#294e42] text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#f4d8a7_0,transparent_28%),radial-gradient(circle_at_85%_65%,#cf7657_0,transparent_24%)]" />
          <div className="absolute -right-20 top-10 hidden h-[420px] w-[420px] rounded-full border border-white/10 lg:block" />
          <div className="absolute -right-6 top-24 hidden h-[300px] w-[300px] rounded-full border border-white/10 lg:block" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:py-28">
            <div>
              <p className="text-xs font-semibold tracking-[0.35em] text-[#e8b59a]">A PRIVATE READING ROOM</p>
              <h1 className="mt-6 max-w-3xl font-serif text-5xl font-bold leading-[1.12] sm:text-6xl lg:text-7xl">把值得重读的故事，<br /><span className="text-[#f1d6a8]">留在自己的书房。</span></h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">{session?.user?.nickname ? `${session.user.nickname}，` : ""}这里收录评分 {stats.minScore} 以上的完整作品。沿着作者、分类与阅读足迹，找到下一本愿意读完的书。</p>
              <form onSubmit={submitSearch} className="mt-9 flex max-w-xl rounded-2xl bg-white p-1.5 shadow-2xl shadow-black/15">
                <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-stone-800 outline-none placeholder:text-stone-400" placeholder="搜索书名或作者" />
                <button className="rounded-xl bg-[#ad573d] px-6 py-3 font-medium text-white transition hover:bg-[#994a34]">翻找书架</button>
              </form>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/60">
                <span><b className="mr-2 font-serif text-xl text-white">{stats.books.toLocaleString("zh-CN")}</b>本精选</span>
                <span><b className="mr-2 font-serif text-xl text-white">{stats.authors.toLocaleString("zh-CN")}</b>位作者</span>
                <span><b className="mr-2 font-serif text-xl text-white">{stats.categories}</b>个门类</span>
              </div>
            </div>
            <div className="relative hidden min-h-[430px] lg:block" aria-hidden="true">
              <div className="absolute left-16 top-0 h-[350px] w-[245px] rotate-[-8deg] rounded-[1.8rem] border border-white/20 bg-[#e8d6b4] p-5 text-[#294e42] shadow-2xl"><div className="flex h-full flex-col rounded-2xl border border-[#294e42]/20 p-6"><span className="text-xs tracking-[0.3em]">知轩藏书</span><span className="mt-auto font-serif text-4xl font-bold leading-tight">好书不必<br />匆匆读完</span><span className="mt-5 text-sm">私人高分典藏</span></div></div>
              <div className="absolute bottom-4 right-8 h-[330px] w-[230px] rotate-[9deg] rounded-[1.8rem] border border-white/20 bg-[#a9553d] p-5 shadow-2xl"><div className="flex h-full flex-col rounded-2xl border border-white/25 p-6"><span className="text-xs tracking-[0.3em] text-white/70">NIGHT READING</span><span className="mt-auto font-serif text-4xl font-bold leading-tight">今夜，<br />读到哪一章？</span></div></div>
            </div>
          </div>
        </section>

        <section id="categories" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-semibold tracking-[0.28em] text-[#a14f37]">EXPLORE BY GENRE</p><h2 className="mt-3 font-serif text-4xl font-bold text-[#263e35]">从喜欢的世界出发</h2></div>
            <p className="max-w-md text-sm leading-6 text-stone-500">分类来自每本书的原始元数据，并随馆藏自动统计。</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => {
              const meta = getCategoryMeta(category.name);
              return <Link key={category.name} href={`/category/${encodeURIComponent(category.name)}`} className="group relative overflow-hidden rounded-[1.4rem] border border-[#ded6c7] bg-white/70 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl"><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 transition group-hover:scale-125" style={{ background: meta.accent }} /><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl font-serif text-lg font-bold text-white" style={{ background: meta.accent }}>{meta.icon}</span><span className="text-xs text-stone-400">{category.count} 本</span></div><h3 className="mt-5 font-serif text-xl font-bold text-[#263e35]">{category.name.replace("精校", "")}</h3><p className="mt-1 text-sm text-stone-500">{meta.description}</p></Link>;
            })}
          </div>
        </section>

        <section id="library" className="border-t border-[#ded6c7] bg-[#eee8dc]/55">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-semibold tracking-[0.28em] text-[#a14f37]">THE LIBRARY</p><h2 className="mt-3 font-serif text-4xl font-bold text-[#263e35]">高分馆藏</h2><p className="mt-3 text-sm text-stone-500">只展示已收录完整正文的作品</p></div>
              <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="rounded-full border border-[#d2c9b9] bg-white px-5 py-2.5 text-sm text-stone-600 outline-none focus:border-[#294e42]"><option value="score">按评分排序</option><option value="xiancao">按仙草票排序</option><option value="popularity">按热度排序</option><option value="latest">按入库时间排序</option></select>
            </div>
            {search && <div className="mt-6 flex items-center gap-3 text-sm text-stone-500">正在查找“{search}”<button onClick={() => { setSearch(""); setQueryInput(""); setPage(1); }} className="text-[#a14f37] hover:underline">清除</button></div>}
            {loading ? <div className="py-24 text-center text-stone-400">正在翻找书架…</div> : books.length ? <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{books.map((book) => <BookCard key={book.id} book={book} />)}</div> : <div className="mt-10 rounded-2xl border border-dashed border-[#d2c9b9] p-16 text-center text-stone-400">没有找到对应的作品</div>}
            {totalPages > 1 && <div className="mt-12 flex items-center justify-center gap-3"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-full border border-[#d2c9b9] bg-white px-5 py-2 text-sm disabled:opacity-40">上一页</button><span className="text-sm text-stone-500">{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-full border border-[#d2c9b9] bg-white px-5 py-2 text-sm disabled:opacity-40">下一页</button></div>}
          </div>
        </section>
      </main>
      <footer className="bg-[#203c33] px-4 py-10 text-center text-sm text-white/45">知轩书房 · 私人高分藏书空间</footer>
    </div>
  );
}
