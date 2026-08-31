"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookCover } from "@/components/BookCover";
import { SiteHeader } from "@/components/SiteHeader";
import { formatReadingPosition, formatWordCount } from "@/lib/format";

interface Vote {
  id: string;
  type: string;
  createdAt: string;
  book: { id: number; title: string; author: string; coverPath: string | null; wordCount: number; chapterCount: number };
}

interface ReadingEntry {
  chapterIdx: number;
  percent: number;
  updatedAt: string;
  book: { id: number; title: string; author: string; tag1: string; hasContent: boolean; chapterCount: number; wordCount: number; coverPath: string | null };
}

const voteTypeLabels: Record<string, string> = {
  XIANCAO: "🌟 仙草",
  LIANGCAO: "🌾 粮草",
  GANCAO: "🌿 干草",
  KUCAO: "🍂 枯草",
  DUCAO: "☠️ 毒草",
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [reading, setReading] = useState<ReadingEntry[]>([]);
  const [shelfCount, setShelfCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;
    Promise.all([fetch("/api/votes"), fetch("/api/progress"), fetch("/api/bookshelf")])
      .then(async ([voteResponse, progressResponse, shelfResponse]) => Promise.all([voteResponse.json(), progressResponse.json(), shelfResponse.json()]))
      .then(([voteData, progressData, shelfData]) => {
        setVotes(voteData.votes || []);
        setReading(progressData.progress || []);
        setShelfCount(shelfData.count || 0);
      })
      .finally(() => setLoading(false));
  }, [router, status]);

  if (status === "loading" || loading) return <div className="min-h-screen bg-[#f5f1e8]"><SiteHeader /><div className="py-32 text-center font-medium text-[#6c655b]">正在整理个人资料…</div></div>;
  if (!session) return null;

  const displayName = session.user.nickname || session.user.username;

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <section className="overflow-hidden rounded-[2rem] border border-[#d3c8b7] bg-[#fffdf8] shadow-[0_22px_65px_rgba(55,45,35,0.08)]">
          <div className="grid gap-7 bg-[#294e42] px-6 py-9 text-white sm:px-9 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#b35d42] font-serif text-3xl font-bold shadow-lg">{displayName.slice(0, 1)}</div>
            <div><p className="text-xs font-semibold tracking-[0.28em] text-[#efb69d]">PRIVATE READER</p><h1 className="mt-2 font-serif text-4xl font-bold">{displayName}</h1><p className="mt-2 font-medium text-white/70">@{session.user.username} · {session.user.role === "ADMIN" ? "书库管理员" : "书库成员"}</p></div>
            <div className="flex gap-7 text-sm text-white/65 md:text-right"><span><b className="block font-serif text-3xl text-white">{shelfCount}</b>书架收藏</span><span><b className="block font-serif text-3xl text-white">{reading.length}</b>阅读记录</span><span><b className="block font-serif text-3xl text-white">{votes.length}</b>书评票</span></div>
          </div>
          <div className="grid divide-y divide-[#e3dbcf] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Link href="/bookshelf" className="group p-6 hover:bg-[#f5f1e8]"><span className="text-xs font-bold tracking-wide text-[#9b4b35]">MY SHELF</span><h2 className="mt-2 font-serif text-xl font-bold text-[#2d4038]">打开我的书架</h2><p className="mt-2 text-sm font-medium leading-6 text-[#6d665c]">收藏作品与继续阅读都在这里</p></Link>
            <Link href="/library" className="group p-6 hover:bg-[#f5f1e8]"><span className="text-xs font-bold tracking-wide text-[#9b4b35]">DISCOVER</span><h2 className="mt-2 font-serif text-xl font-bold text-[#2d4038]">浏览完整书库</h2><p className="mt-2 text-sm font-medium leading-6 text-[#6d665c]">按题材、评分和篇幅精确筛选</p></Link>
            {session.user.role === "ADMIN" ? <Link href="/register" className="group p-6 hover:bg-[#f5f1e8]"><span className="text-xs font-bold tracking-wide text-[#9b4b35]">MEMBERS</span><h2 className="mt-2 font-serif text-xl font-bold text-[#2d4038]">添加书库成员</h2><p className="mt-2 text-sm font-medium leading-6 text-[#6d665c]">为熟人创建独立登录账号</p></Link> : <div className="p-6"><span className="text-xs font-bold tracking-wide text-[#9b4b35]">ACCOUNT</span><h2 className="mt-2 font-serif text-xl font-bold text-[#2d4038]">私人阅读账号</h2><p className="mt-2 text-sm font-medium leading-6 text-[#6d665c]">进度、书架和投票仅保存在本站</p></div>}
          </div>
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <section>
            <div className="flex items-end justify-between"><div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">RECENTLY READ</p><h2 className="mt-2 font-serif text-3xl font-bold text-[#263e35]">最近阅读</h2></div><Link href="/bookshelf" className="text-sm font-semibold text-[#9b4b35] hover:underline">完整足迹 →</Link></div>
            {reading.length === 0 ? <div className="mt-6 rounded-[1.5rem] border border-[#ddd3c2] bg-[#fffdf8] p-12 text-center"><p className="font-medium text-[#6d665c]">还没有阅读记录。</p><Link href="/library" className="mt-4 inline-block font-semibold text-[#9b4b35]">去书库挑一本</Link></div> : <div className="mt-6 space-y-4">{reading.slice(0, 8).map((item) => <article key={item.book.id} className="flex items-center gap-4 rounded-[1.4rem] border border-[#ddd3c2] bg-[#fffdf8] p-4 shadow-[0_10px_30px_rgba(55,45,35,0.04)]"><BookCover id={item.book.id} title={item.book.title} coverPath={item.book.coverPath} className="h-20 w-14 shrink-0 rounded-lg object-cover shadow" sizes="56px" /><div className="min-w-0 flex-1"><Link href={`/book/${item.book.id}`} className="line-clamp-1 font-serif text-lg font-bold text-[#2d4038] hover:text-[#994b35]">{item.book.title}</Link><p className="mt-1 line-clamp-1 text-sm font-medium text-[#6d665c]">{item.book.author} · {item.book.tag1.replace("精校", "")}</p><p className="mt-2 text-xs font-semibold text-[#8e503d]">{formatReadingPosition(item.chapterIdx, item.percent)} · {formatWordCount(item.book.wordCount)}</p></div>{item.book.hasContent && <Link href={`/read/${item.book.id}?c=${item.chapterIdx}`} className="shrink-0 rounded-full bg-[#315f50] px-4 py-2 text-sm font-semibold text-white">继续</Link>}</article>)}</div>}
          </section>

          <section>
            <div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">MY RATINGS</p><h2 className="mt-2 font-serif text-3xl font-bold text-[#263e35]">我的投票</h2><p className="mt-2 text-sm font-medium leading-6 text-[#6d665c]">这些评价只属于当前私人书库实例。</p></div>
            {votes.length === 0 ? <div className="mt-6 rounded-[1.5rem] border border-[#ddd3c2] bg-[#fffdf8] p-10 text-center font-medium text-[#6d665c]">还没有给作品投票。</div> : <div className="mt-6 divide-y divide-[#e3dbcf] overflow-hidden rounded-[1.5rem] border border-[#ddd3c2] bg-[#fffdf8]">{votes.slice(0, 12).map((vote) => <Link key={vote.id} href={`/book/${vote.book.id}`} className="block p-4 hover:bg-[#f5f1e8]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="line-clamp-1 font-serif font-bold text-[#2d4038]">{vote.book.title}</h3><p className="mt-1 text-xs font-medium text-[#746d62]">{vote.book.author} · {new Date(vote.createdAt).toLocaleDateString("zh-CN")}</p></div><span className="shrink-0 rounded-full bg-[#edf1ed] px-2.5 py-1 text-xs font-bold text-[#315f50]">{voteTypeLabels[vote.type]}</span></div></Link>)}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
