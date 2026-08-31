"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookCover } from "@/components/BookCover";
import { SiteHeader } from "@/components/SiteHeader";
import { formatReadingPosition, formatWordCount } from "@/lib/format";

interface Book {
  id: number;
  title: string;
  author: string;
  tag1: string;
  tag2: string;
  size: string;
  intro: string;
  score: number;
  xiancaoCount: number;
  liangcaoCount: number;
  gancaoCount: number;
  kucaoCount: number;
  ducaoCount: number;
  popularity: number;
  hasContent: boolean;
  chapterCount: number;
  wordCount: number;
  coverPath: string | null;
  _count: { comments: number; votes: number };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { username: string; nickname: string | null };
  replies: Comment[];
}

const voteTypes = [
  { type: "XIANCAO", label: "仙草", emoji: "🌟", description: "非常值得读" },
  { type: "LIANGCAO", label: "粮草", emoji: "🌾", description: "整体很好看" },
  { type: "GANCAO", label: "干草", emoji: "🌿", description: "可以读一读" },
  { type: "KUCAO", label: "枯草", emoji: "🍂", description: "不太推荐" },
  { type: "DUCAO", label: "毒草", emoji: "☠️", description: "建议避开" },
];

export default function BookDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [book, setBook] = useState<Book | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ chapterIdx: number; percent: number } | null>(null);
  const [inBookshelf, setInBookshelf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchBook = useCallback(async () => {
    try {
      const response = await fetch(`/api/books/${id}`);
      const data = await response.json();
      setBook(data.book || null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    const response = await fetch(`/api/comments?bookId=${id}`);
    if (response.ok) setComments((await response.json()).comments || []);
  }, [id]);

  const fetchPersonalState = useCallback(async () => {
    const [voteResponse, progressResponse, shelfResponse] = await Promise.all([
      fetch(`/api/votes?bookId=${id}`),
      fetch(`/api/books/${id}/progress`),
      fetch(`/api/bookshelf?bookId=${id}`),
    ]);
    if (voteResponse.ok) setUserVote((await voteResponse.json()).vote?.type || null);
    if (progressResponse.ok) {
      const data = await progressResponse.json();
      if (data.progress) setProgress({ chapterIdx: data.progress.chapterIdx, percent: data.progress.percent });
    }
    if (shelfResponse.ok) setInBookshelf((await shelfResponse.json()).inBookshelf || false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchBook();
    fetchComments();
    if (session) {
      fetchPersonalState();
    }
  }, [fetchBook, fetchComments, fetchPersonalState, id, session]);

  const handleShelf = async () => {
    if (!session || !book) return;
    setShelfLoading(true);
    try {
      const response = await fetch(inBookshelf ? `/api/bookshelf?bookId=${book.id}` : "/api/bookshelf", {
        method: inBookshelf ? "DELETE" : "POST",
        headers: inBookshelf ? undefined : { "Content-Type": "application/json" },
        body: inBookshelf ? undefined : JSON.stringify({ bookId: book.id }),
      });
      if (response.ok) setInBookshelf(!inBookshelf);
    } finally {
      setShelfLoading(false);
    }
  };

  const handleVote = async (type: string) => {
    if (!session || userVote) return;
    const response = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: Number(id), type }),
    });
    if (response.ok) {
      setUserVote(type);
      fetchBook();
    } else {
      const data = await response.json();
      alert(data.error || "投票失败");
    }
  };

  const handleComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: Number(id), content: newComment }),
      });
      if (response.ok) {
        setNewComment("");
        fetchComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#f5f1e8]"><SiteHeader /><div className="py-32 text-center font-medium text-[#6c655b]">正在取下这本书…</div></div>;
  if (!book) return <div className="min-h-screen bg-[#f5f1e8]"><SiteHeader /><div className="py-32 text-center"><p className="font-serif text-2xl font-bold text-[#2d4038]">没有找到这本书</p><Link href="/library" className="mt-5 inline-block font-semibold text-[#9b4b35]">返回书库</Link></div></div>;

  const readHref = `/read/${book.id}${progress ? `?c=${progress.chapterIdx}` : ""}`;
  const voteStats = [
    { label: "仙草", value: book.xiancaoCount, color: "#2f765e" },
    { label: "粮草", value: book.liangcaoCount, color: "#a66a00" },
    { label: "干草", value: book.gancaoCount, color: "#5f665b" },
    { label: "枯草", value: book.kucaoCount, color: "#b35425" },
    { label: "毒草", value: book.ducaoCount, color: "#a83b3b" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="overflow-hidden rounded-[2rem] border border-[#d9cfbf] bg-[#fffdf8] shadow-[0_24px_70px_rgba(55,45,35,0.08)]">
          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[176px_minmax(0,1fr)] lg:gap-11 lg:p-10">
            <div className="mx-auto md:mx-0"><BookCover id={book.id} title={book.title} coverPath={book.coverPath} className="h-60 w-44 rounded-xl object-cover shadow-[0_18px_40px_rgba(43,38,32,0.24)]" sizes="176px" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2"><Link href={`/category/${encodeURIComponent(book.tag1)}`} className="rounded-full bg-[#e7eee9] px-3 py-1.5 text-xs font-bold text-[#315f50]">{book.tag1.replace("精校", "")}</Link><span className="rounded-full bg-[#f2e9df] px-3 py-1.5 text-xs font-bold text-[#8e503d]">{book.tag2}</span></div>
              <h1 className="mt-4 font-serif text-3xl font-bold leading-tight text-[#233a31] sm:text-4xl">{book.title}</h1>
              <p className="mt-3 text-base font-medium text-[#645d53]">作者 · <Link href={`/author/${encodeURIComponent(book.author)}`} className="font-bold text-[#315f50] hover:text-[#9b4b35] hover:underline">{book.author}</Link></p>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e1d8ca] bg-[#faf7f0] p-3"><p className="text-xs font-bold tracking-wide text-[#7a7267]">章节</p><p className="mt-1 font-serif text-xl font-bold text-[#2d4038]">{book.chapterCount.toLocaleString("zh-CN")} 章</p></div>
                <div className="rounded-xl border border-[#e1d8ca] bg-[#faf7f0] p-3"><p className="text-xs font-bold tracking-wide text-[#7a7267]">篇幅</p><p className="mt-1 font-serif text-xl font-bold text-[#2d4038]">{formatWordCount(book.wordCount, book.size)}</p></div>
                <div className="col-span-2 rounded-xl border border-[#e1d8ca] bg-[#faf7f0] p-3 sm:col-span-1"><p className="text-xs font-bold tracking-wide text-[#7a7267]">综合评分</p><p className="mt-1 font-serif text-xl font-bold text-[#9b4b35]">{book.score.toFixed(2)} 分</p></div>
              </div>

              {progress && <p className="mt-5 text-sm font-semibold text-[#8c4d39]">上次读到 {formatReadingPosition(progress.chapterIdx, progress.percent)}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                {book.hasContent ? <Link href={readHref} className="rounded-xl bg-[#315f50] px-6 py-3 font-semibold text-white shadow-lg shadow-[#315f50]/15 hover:bg-[#284e42]">{progress ? "继续阅读" : "开始阅读"}</Link> : <span className="rounded-xl bg-[#e4ded3] px-6 py-3 font-semibold text-[#777064]">暂无正文</span>}
                <button onClick={handleShelf} disabled={shelfLoading} className={`rounded-xl border px-6 py-3 font-semibold transition disabled:opacity-50 ${inBookshelf ? "border-[#a9553d] bg-[#f8eee8] text-[#93452f]" : "border-[#315f50] bg-white text-[#315f50] hover:bg-[#eef3ef]"}`}>{shelfLoading ? "处理中…" : inBookshelf ? "✓ 已加入书架" : "+ 加入书架"}</button>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section className="rounded-[1.75rem] border border-[#d9cfbf] bg-[#fffdf8] p-6 sm:p-8">
              <p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">ABOUT THIS BOOK</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#263e35]">内容简介</h2>
              <p className="mt-5 whitespace-pre-wrap text-[15px] font-medium leading-8 text-[#514c44] sm:text-base">{book.intro}</p>
            </section>

            <section className="rounded-[1.75rem] border border-[#d9cfbf] bg-[#fffdf8] p-6 sm:p-8">
              <div className="flex items-end justify-between"><div><p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">DISCUSSION</p><h2 className="mt-2 font-serif text-2xl font-bold text-[#263e35]">书友评论</h2></div><span className="text-sm font-semibold text-[#70695f]">{book._count.comments} 条</span></div>
              {session ? <form onSubmit={handleComment} className="mt-6"><textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="写下你的阅读感受…" className="w-full resize-none rounded-xl border border-[#d6ccbc] bg-white p-4 font-medium leading-7 text-[#3d3933] outline-none placeholder:text-[#91897d] focus:border-[#315f50] focus:ring-4 focus:ring-[#315f50]/10" rows={4} maxLength={1000} /><div className="mt-2 flex items-center justify-between"><span className="text-xs font-medium text-[#80786d]">{newComment.length}/1000</span><button type="submit" disabled={submitting || !newComment.trim()} className="rounded-xl bg-[#315f50] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-45">{submitting ? "发送中…" : "发表评论"}</button></div></form> : <p className="mt-6 rounded-xl bg-[#f2eee6] p-4 text-center font-medium text-[#665f55]">登录后可以发表评论</p>}

              <div className="mt-8 space-y-6">{comments.length === 0 ? <p className="py-8 text-center font-medium text-[#756e63]">还没有评论，读完来说两句吧。</p> : comments.map((comment) => <article key={comment.id} className="border-t border-[#e5ddd1] pt-6"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#315f50] font-serif font-bold text-white">{(comment.user.nickname || comment.user.username).slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-bold text-[#30483e]">{comment.user.nickname || comment.user.username}</span><time className="text-xs font-medium text-[#827a6f]">{new Date(comment.createdAt).toLocaleString("zh-CN")}</time></div><p className="mt-2 whitespace-pre-wrap font-medium leading-7 text-[#4c4841]">{comment.content}</p>{comment.replies?.length > 0 && <div className="mt-4 space-y-3 border-l-2 border-[#d9d0c2] pl-4">{comment.replies.map((reply) => <div key={reply.id}><p className="text-sm font-bold text-[#30483e]">{reply.user.nickname || reply.user.username}</p><p className="mt-1 text-sm font-medium leading-6 text-[#575149]">{reply.content}</p></div>)}</div>}</div></div></article>)}</div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border border-[#d9cfbf] bg-[#fffdf8] p-6">
              <p className="text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">COMMUNITY RATING</p><div className="mt-3 flex items-end gap-2"><strong className="font-serif text-5xl text-[#294e42]">{book.score.toFixed(1)}</strong><span className="pb-1 text-sm font-semibold text-[#71695f]">/ 10</span></div>
              <div className="mt-6 grid grid-cols-5 gap-2">{voteStats.map((item) => <div key={item.label} className="text-center"><strong className="block text-lg" style={{ color: item.color }}>{item.value}</strong><span className="mt-1 block text-[11px] font-bold text-[#756e63]">{item.label}</span></div>)}</div>
            </section>

            <section className="rounded-[1.75rem] border border-[#d9cfbf] bg-[#fffdf8] p-6">
              <h2 className="font-serif text-xl font-bold text-[#263e35]">{userVote ? "我的评价" : "这本书怎么样？"}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#6c655b]">每个账号对一本书只能评价一次。</p>
              <div className="mt-5 space-y-2">{voteTypes.map((vote) => <button key={vote.type} onClick={() => handleVote(vote.type)} disabled={!session || !!userVote} className={`flex w-full items-center rounded-xl border px-3 py-2.5 text-left transition ${userVote === vote.type ? "border-[#315f50] bg-[#315f50] text-white" : userVote ? "border-[#e2dbd0] bg-[#f3efe8] text-[#9a9388]" : "border-[#d8cfc0] bg-white text-[#48443e] hover:border-[#315f50] hover:bg-[#f0f4f1]"}`}><span className="mr-3 text-lg">{vote.emoji}</span><span><b className="block text-sm">{vote.label}</b><small className={`text-xs font-medium ${userVote === vote.type ? "text-white/70" : "text-[#777065]"}`}>{vote.description}</small></span></button>)}</div>
              <p className="mt-5 rounded-xl bg-[#f2eee6] p-3 text-xs font-medium leading-5 text-[#6d655a]">评价只写入当前这套私人书库的数据库，不会同步到知轩原站或其他人的部署。</p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
