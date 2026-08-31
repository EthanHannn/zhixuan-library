"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookCard } from "@/components/BookCard";
import { SiteHeader } from "@/components/SiteHeader";
import type { BookSummary, CategorySummary } from "@/types/catalog";

interface FilterData {
  categories: CategorySummary[];
  subcategories: CategorySummary[];
  stats: { books: number; authors: number; minScore: number };
}

const WORD_RANGES = [
  { value: "", label: "不限篇幅", min: 0, max: 0 },
  { value: "short", label: "50 万字以内", min: 1, max: 500_000 },
  { value: "medium", label: "50—100 万字", min: 500_001, max: 1_000_000 },
  { value: "long", label: "100—200 万字", min: 1_000_001, max: 2_000_000 },
  { value: "epic", label: "200 万字以上", min: 2_000_001, max: 0 },
];

const SCORE_OPTIONS = [
  { value: "7.5", label: "7.5 分以上" },
  { value: "8", label: "8.0 分以上" },
  { value: "8.5", label: "8.5 分以上" },
  { value: "9", label: "9.0 分以上" },
];

export default function LibraryPage() {
  const [filters, setFilters] = useState<FilterData>({ categories: [], subcategories: [], stats: { books: 0, authors: 0, minScore: 7.5 } });
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tag1, setTag1] = useState("");
  const [tag2, setTag2] = useState("");
  const [minScore, setMinScore] = useState("7.5");
  const [wordRange, setWordRange] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialSearch = params.get("search") || "";
    setSearch(initialSearch);
    setSearchInput(initialSearch);
    setTag1(params.get("tag1") || "");
    setTag2(params.get("tag2") || "");
    setMinScore(params.get("minScore") || "7.5");
    setWordRange(params.get("words") || "");
    setSortBy(params.get("sortBy") || "score");
    setPage(Math.max(1, parseInt(params.get("page") || "1") || 1));
    setReady(true);
    fetch("/api/categories")
      .then((response) => response.json())
      .then((data) => setFilters({ categories: data.categories || [], subcategories: data.subcategories || [], stats: data.stats || { books: 0, authors: 0, minScore: 7.5 } }))
      .catch(() => undefined);
  }, []);

  const activeWordRange = useMemo(() => WORD_RANGES.find((item) => item.value === wordRange) || WORD_RANGES[0], [wordRange]);

  const loadBooks = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "24",
      onlyContent: "1",
      minScore,
      sortBy,
    });
    if (search) params.set("search", search);
    if (tag1) params.set("tag1", tag1);
    if (tag2) params.set("tag2", tag2);
    if (activeWordRange.min) params.set("minWords", String(activeWordRange.min));
    if (activeWordRange.max) params.set("maxWords", String(activeWordRange.max));

    const urlParams = new URLSearchParams(params);
    urlParams.delete("limit");
    urlParams.delete("onlyContent");
    if (wordRange) urlParams.set("words", wordRange);
    urlParams.delete("minWords");
    urlParams.delete("maxWords");
    window.history.replaceState(null, "", `/library?${urlParams.toString()}`);

    try {
      const response = await fetch(`/api/books?${params}`);
      const data = await response.json();
      setBooks(data.books || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [activeWordRange.max, activeWordRange.min, minScore, page, ready, search, sortBy, tag1, tag2, wordRange]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setTag1("");
    setTag2("");
    setMinScore("7.5");
    setWordRange("");
    setSortBy("score");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main>
        <section className="border-b border-[#d8d0c0] bg-[#294e42] text-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-18">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#efb69d]">DISCOVER YOUR NEXT BOOK</p>
            <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="font-serif text-4xl font-bold sm:text-5xl">书库</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">按分类、题材、评分与篇幅筛选，在 {filters.stats.books.toLocaleString("zh-CN")} 本高分正文里找到下一本。</p>
              </div>
              <div className="flex gap-6 text-sm text-white/65">
                <span><b className="mr-2 font-serif text-2xl text-white">{filters.stats.books.toLocaleString("zh-CN")}</b>本书</span>
                <span><b className="mr-2 font-serif text-2xl text-white">{filters.stats.authors.toLocaleString("zh-CN")}</b>位作者</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
          <section className="rounded-[1.75rem] border border-[#dcd3c3] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(55,45,35,0.06)] sm:p-7">
            <form onSubmit={applySearch} className="flex flex-col gap-3 sm:flex-row">
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#cec3b2] bg-white px-4 py-3 text-[#292722] outline-none placeholder:text-[#8f877b] focus:border-[#315f50] focus:ring-4 focus:ring-[#315f50]/10" placeholder="搜索书名或作者" />
              <button className="rounded-xl bg-[#a9553d] px-7 py-3 font-semibold text-white transition hover:bg-[#91452f]">搜索书库</button>
            </form>

            <div className="mt-7 space-y-6">
              <div>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-[#3b3832]">作品分类</h2><button onClick={resetFilters} type="button" className="text-xs font-medium text-[#9b4b35] hover:underline">重置全部</button></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setTag1(""); setPage(1); }} className={`rounded-full border px-3.5 py-2 text-sm transition ${!tag1 ? "border-[#315f50] bg-[#315f50] text-white" : "border-[#d8d0c0] bg-white text-[#5e584f] hover:border-[#315f50]"}`}>全部</button>
                  {filters.categories.map((category) => <button type="button" key={category.name} onClick={() => { setTag1(category.name); setPage(1); }} className={`rounded-full border px-3.5 py-2 text-sm transition ${tag1 === category.name ? "border-[#315f50] bg-[#315f50] text-white" : "border-[#d8d0c0] bg-white text-[#5e584f] hover:border-[#315f50]"}`}>{category.name.replace("精校", "")} <span className="opacity-65">{category.count}</span></button>)}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="block"><span className="mb-2 block text-sm font-bold text-[#3b3832]">细分题材</span><select value={tag2} onChange={(event) => { setTag2(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#d8d0c0] bg-white px-4 py-3 text-sm text-[#514c44] outline-none focus:border-[#315f50]"><option value="">全部题材</option>{filters.subcategories.map((category) => <option key={category.name} value={category.name}>{category.name}（{category.count}）</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-bold text-[#3b3832]">最低评分</span><select value={minScore} onChange={(event) => { setMinScore(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#d8d0c0] bg-white px-4 py-3 text-sm text-[#514c44] outline-none focus:border-[#315f50]">{SCORE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-bold text-[#3b3832]">作品篇幅</span><select value={wordRange} onChange={(event) => { setWordRange(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#d8d0c0] bg-white px-4 py-3 text-sm text-[#514c44] outline-none focus:border-[#315f50]">{WORD_RANGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">SEARCH RESULTS</p><h2 className="mt-2 font-serif text-3xl font-bold text-[#263e35]">馆藏作品</h2><p className="mt-2 text-sm font-medium text-[#6d665c]">找到 {total.toLocaleString("zh-CN")} 本符合条件的作品</p></div>
              <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="rounded-full border border-[#cfc4b3] bg-[#fffdf8] px-5 py-2.5 text-sm font-medium text-[#554f47] outline-none focus:border-[#315f50]"><option value="score">评分优先</option><option value="xiancao">仙草票优先</option><option value="popularity">热度优先</option><option value="words">字数从多到少</option><option value="latest">最近入库</option><option value="title">书名排序</option></select>
            </div>

            {loading ? <div className="py-24 text-center font-medium text-[#716a60]">正在整理馆藏…</div> : books.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{books.map((book) => <BookCard key={book.id} book={book} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-[#cfc4b3] bg-white/50 p-16 text-center text-[#6d665c]">没有符合当前条件的作品，试试放宽筛选。</div>}

            {totalPages > 1 && <div className="mt-12 flex items-center justify-center gap-3"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-full border border-[#cfc4b3] bg-white px-5 py-2.5 text-sm font-medium text-[#514c44] disabled:opacity-40">上一页</button><span className="min-w-24 text-center text-sm font-medium text-[#625c53]">{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-full border border-[#cfc4b3] bg-white px-5 py-2.5 text-sm font-medium text-[#514c44] disabled:opacity-40">下一页</button></div>}
          </section>
        </div>
      </main>
    </div>
  );
}
