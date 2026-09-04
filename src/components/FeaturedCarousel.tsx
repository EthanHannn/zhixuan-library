"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import type { BookSummary } from "@/types/catalog";

interface FeaturedCarouselProps {
  books: BookSummary[];
  nickname?: string | null;
  stats: {
    books: number;
    authors: number;
    categories: number;
    minScore: number;
  };
}

const SLIDE_BACKGROUNDS = [
  "from-[#183d36] via-[#2d5b4c] to-[#806045]",
  "from-[#30233f] via-[#594364] to-[#9a654e]",
  "from-[#243b55] via-[#31566d] to-[#8a6a52]",
  "from-[#4a2c2a] via-[#7b463b] to-[#b27b56]",
  "from-[#233831] via-[#3f6253] to-[#7d7760]",
];

export function FeaturedCarousel({ books, nickname, stats }: FeaturedCarouselProps) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (paused || books.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % books.length), 6500);
    return () => window.clearInterval(timer);
  }, [books.length, paused]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    router.push(query.trim() ? `/library?search=${encodeURIComponent(query.trim())}` : "/library");
  };

  const activeIndex = books.length > 0 ? active % books.length : 0;
  const current = books[activeIndex] || null;
  const setPrevious = () => setActive((currentIndex) => (currentIndex - 1 + books.length) % books.length);
  const setNext = () => setActive((currentIndex) => (currentIndex + 1) % books.length);

  return (
    <section
      className="relative overflow-hidden text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="精品小说推荐"
    >
      <div className={`absolute inset-0 bg-gradient-to-br transition-colors duration-700 ${SLIDE_BACKGROUNDS[activeIndex % SLIDE_BACKGROUNDS.length]}`} />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_15%_20%,white_0,transparent_28%),radial-gradient(circle_at_82%_28%,#f5d2a3_0,transparent_23%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,24,21,.3),transparent_55%,rgba(12,20,18,.2))]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-7 pt-10 sm:px-6 sm:pb-9 sm:pt-14 lg:pb-10 lg:pt-16">
        <div className="grid min-h-[430px] items-center gap-9 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-xs font-bold tracking-[0.28em] text-[#f4c9a6]">
              <span className="h-px w-8 bg-current" />
              READERS&apos; CHOICE · 仙草高票随机推荐
            </div>
            {current ? (
              <div key={current.id} className="animate-[fade-in_.45s_ease-out]">
                <h1 className="mt-5 line-clamp-2 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{current.title}</h1>
                <p className="mt-4 text-base font-semibold text-white/80">{current.author} · {current.tag1.replace("精校", "")} · {current.tag2}</p>
                <p className="mt-5 line-clamp-3 max-w-2xl text-sm font-medium leading-7 text-white/72 sm:text-base sm:leading-8">{current.intro || `${nickname ? `${nickname}，` : ""}从高分书库中挑选的完整作品，值得放进书架慢慢读。`}</p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href={`/read/${current.id}`} className="rounded-xl bg-[#f4d6ac] px-6 py-3 text-sm font-bold text-[#29443a] shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:bg-white">立即阅读</Link>
                  <Link href={`/book/${current.id}`} className="rounded-xl border border-white/35 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">查看详情</Link>
                  <span className="ml-1 rounded-full bg-black/15 px-3 py-1.5 text-sm font-bold text-[#ffe0b9]">🌟 {current.xiancaoCount.toLocaleString("zh-CN")} 票仙草</span>
                  <span className="rounded-full bg-black/15 px-3 py-1.5 font-serif text-lg font-bold text-[#ffe0b9]">{current.score.toFixed(1)} 分</span>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">把值得重读的故事，留在自己的书房。</h1>
                <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-white/75">正在从高分藏书中整理本期精品推荐……</p>
              </div>
            )}

            <form onSubmit={submitSearch} className="mt-8 flex max-w-xl rounded-2xl bg-white p-1.5 shadow-2xl shadow-black/15">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[#302d28] outline-none placeholder:text-[#8a8277]" placeholder="搜索书名或作者" aria-label="搜索书名或作者" />
              <button className="rounded-xl bg-[#ad573d] px-5 py-3 font-semibold text-white transition hover:bg-[#994a34] sm:px-6">搜索书库</button>
            </form>
          </div>

          <div className="relative mx-auto hidden h-[390px] w-full max-w-[430px] sm:block" aria-hidden="true">
            {current && (
              <>
                <div className="absolute left-2 top-12 h-[300px] w-[205px] rotate-[-8deg] overflow-hidden rounded-[1.6rem] bg-white/10 opacity-45 shadow-2xl blur-[.2px]">
                  <BookCover id={books[(activeIndex + 1) % books.length]?.id || current.id} title={books[(activeIndex + 1) % books.length]?.title || current.title} coverPath={books[(activeIndex + 1) % books.length]?.coverPath || current.coverPath} className="h-full w-full object-cover" sizes="205px" />
                </div>
                <Link href={`/book/${current.id}`} className="absolute right-8 top-0 block h-[360px] w-[250px] rotate-[4deg] overflow-hidden rounded-[1.7rem] border border-white/25 bg-[#eee4d2] shadow-[0_28px_70px_rgba(0,0,0,.35)] transition hover:rotate-1 hover:scale-[1.02]" tabIndex={-1}>
                  <BookCover id={current.id} title={current.title} coverPath={current.coverPath} priority className="h-full w-full object-cover" sizes="250px" />
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/15 pt-5">
          <div className="hidden flex-wrap gap-x-7 gap-y-2 text-xs font-medium text-white/65 sm:flex">
            <span><b className="mr-1.5 font-serif text-lg text-white">{stats.books.toLocaleString("zh-CN")}</b>本精选</span>
            <span><b className="mr-1.5 font-serif text-lg text-white">{stats.authors.toLocaleString("zh-CN")}</b>位作者</span>
            <span><b className="mr-1.5 font-serif text-lg text-white">{stats.categories}</b>个门类</span>
            <span>只收录评分 {stats.minScore} 以上作品</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={setPrevious} disabled={books.length < 2} className="flex size-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg disabled:opacity-35" aria-label="上一项精品推荐">‹</button>
            <div className="flex items-center gap-1.5 px-1">
              {books.map((book, index) => <button key={book.id} type="button" onClick={() => setActive(index)} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-7 bg-[#f4d6ac]" : "w-2 bg-white/35 hover:bg-white/60"}`} aria-label={`查看推荐：${book.title}`} aria-current={index === activeIndex ? "true" : undefined} />)}
            </div>
            <button type="button" onClick={setNext} disabled={books.length < 2} className="flex size-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg disabled:opacity-35" aria-label="下一项精品推荐">›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
