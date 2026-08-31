"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
  postId: number | null;
  submittedBy?: {
    username: string;
  };
  _count: {
    comments: number;
    votes: number;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
  };
  replies: Comment[];
}

const voteTypes = [
  { type: "XIANCAO", label: "仙草", emoji: "🌟", color: "text-green-600" },
  { type: "LIANGCAO", label: "粮草", emoji: "🌾", color: "text-yellow-600" },
  { type: "GANCAO", label: "干草", emoji: "🌿", color: "text-gray-600" },
  { type: "KUCAO", label: "枯草", emoji: "🍂", color: "text-orange-600" },
  { type: "DUCAO", label: "毒草", emoji: "☠️", color: "text-red-600" }
];

export default function BookDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [book, setBook] = useState<Book | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ chapterIdx: number; percent: number } | null>(null);

  useEffect(() => {
    if (id) {
      fetchBook();
      fetchComments();
      if (session) {
        fetchUserVote();
        fetchProgress();
      } else {
        try {
          const raw = localStorage.getItem(`zx_reading_${id}`);
          if (raw) {
            const p = JSON.parse(raw);
            if (p?.chapterIdx) setProgress({ chapterIdx: p.chapterIdx, percent: p.percent || 0 });
          }
        } catch { /* ignore */ }
      }
    }
  }, [id, session]);

  const fetchProgress = async () => {
    try {
      const res = await fetch(`/api/books/${id}/progress`);
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setProgress({ chapterIdx: data.progress.chapterIdx, percent: data.progress.percent });
        }
      }
    } catch (error) {
      console.error("获取阅读进度失败:", error);
    }
  };

  const fetchBook = async () => {
    try {
      const res = await fetch(`/api/books/${id}`);
      const data = await res.json();
      setBook(data.book);
    } catch (error) {
      console.error("获取书籍失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?bookId=${id}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error("获取评论失败:", error);
    }
  };

  const fetchUserVote = async () => {
    try {
      const res = await fetch(`/api/votes?bookId=${id}`);
      const data = await res.json();
      setUserVote(data.vote?.type || null);
    } catch (error) {
      console.error("获取投票失败:", error);
    }
  };

  const handleVote = async (type: string) => {
    if (!session) {
      alert("请先登录");
      return;
    }

    if (userVote) {
      alert("您已经投过票了");
      return;
    }

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: parseInt(id as string), type })
      });

      if (res.ok) {
        setUserVote(type);
        fetchBook(); // 刷新书籍数据
      } else {
        const data = await res.json();
        alert(data.error || "投票失败");
      }
    } catch (error) {
      alert("投票失败");
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      alert("请先登录");
      return;
    }

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: parseInt(id as string),
          content: newComment
        })
      });

      if (res.ok) {
        setNewComment("");
        fetchComments();
      } else {
        const data = await res.json();
        alert(data.error || "评论失败");
      }
    } catch (error) {
      alert("评论失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F2EB] dark:bg-[#1C1C1E] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F5D50]"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-[#F2F2EB] dark:bg-[#1C1C1E] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-400">书籍不存在</p>
          <Link href="/" className="mt-4 inline-block text-[#2F5D50] hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2EB] dark:bg-[#1C1C1E]">
      {/* 头部导航 */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="text-[#2F5D50] hover:underline">
            ← 返回首页
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 书籍信息 */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* 封面 */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <img
                src={`/covers/${book.id}.svg`}
                alt={book.title}
                className="w-44 h-60 object-cover rounded-lg shadow-lg"
              />
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9] mb-4">
                {book.title}
              </h1>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <span>作者: {book.author}</span>
                <span>分类: {book.tag1} / {book.tag2}</span>
                <span>字数: {book.size}</span>
                {book.hasContent && (
                  <span className="text-[#2F5D50] dark:text-[#5A9A85]">共 {book.chapterCount} 章</span>
                )}
              </div>

              {/* 阅读操作区 */}
              <div className="flex flex-wrap gap-3 mb-6">
                {book.hasContent ? (
                  <Link
                    href={`/read/${book.id}${progress ? `?c=${progress.chapterIdx}` : ""}`}
                    className="px-6 py-2.5 bg-[#2F5D50] text-white rounded-lg hover:bg-[#3d7766] transition text-center"
                  >
                    {progress ? `继续阅读（第 ${progress.chapterIdx} 章${progress.percent > 0.02 ? ` · ${Math.round(progress.percent * 100)}%` : ""}）` : "开始阅读"}
                  </Link>
                ) : (
                  <span className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed">
                    暂无本地正文
                  </span>
                )}
                {book.postId && (
                  <a
                    href={`http://zxcs.me/post/${book.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-center"
                  >
                    查看原站 ↗
                  </a>
                )}
              </div>

              {/* 评分和投票统计 */}
              <div className="flex flex-wrap gap-6 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#2F5D50]">{book.score.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">综合评分</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{book.xiancaoCount}</div>
                  <div className="text-sm text-gray-500">🌟 仙草</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{book.liangcaoCount}</div>
                  <div className="text-sm text-gray-500">🌾 粮草</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{book.gancaoCount}</div>
                  <div className="text-sm text-gray-500">🌿 干草</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{book.kucaoCount}</div>
                  <div className="text-sm text-gray-500">🍂 枯草</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{book.ducaoCount}</div>
                  <div className="text-sm text-gray-500">☠️ 毒草</div>
                </div>
              </div>
            </div>
          </div>

          {/* 简介 */}
          <div className="mb-6 mt-6">
            <h2 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E8E4D9] mb-2">简介</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {book.intro}
            </p>
          </div>

          {/* 投票按钮 */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#E8E4D9] mb-4">
              {userVote ? "您已投票" : "为这本书投票"}
            </h3>
            <div className="flex flex-wrap gap-3">
              {voteTypes.map((vote) => (
                <button
                  key={vote.type}
                  onClick={() => handleVote(vote.type)}
                  disabled={!!userVote}
                  className={`px-4 py-2 rounded-lg border transition ${
                    userVote === vote.type
                      ? "bg-[#2F5D50] text-white border-[#2F5D50]"
                      : userVote
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "bg-white hover:bg-gray-50 border-gray-300 hover:border-[#2F5D50]"
                  }`}
                >
                  <span className="mr-1">{vote.emoji}</span>
                  {vote.label}
                </button>
              ))}
            </div>
            {!session && (
              <p className="mt-2 text-sm text-gray-500">
                <Link href="/login" className="text-[#2F5D50] hover:underline">登录</Link> 后可以投票
              </p>
            )}
          </div>
        </div>

        {/* 评论区 */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8">
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9] mb-6">
            评论 ({book._count.comments})
          </h2>

          {/* 发表评论 */}
          {session ? (
            <form onSubmit={handleComment} className="mb-8">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="写下你的评论..."
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F5D50] dark:bg-gray-700 dark:text-white resize-none"
                rows={4}
                maxLength={1000}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">{newComment.length}/1000</span>
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-6 py-2 bg-[#2F5D50] text-white rounded hover:bg-[#3d7766] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "发送中..." : "发表评论"}
                </button>
              </div>
            </form>
          ) : (
            <p className="mb-8 p-4 bg-gray-100 dark:bg-gray-700/50 rounded text-center text-gray-600 dark:text-gray-400">
              <Link href="/login" className="text-[#2F5D50] hover:underline">登录</Link> 后可以发表评论
            </p>
          )}

          {/* 评论列表 */}
          <div className="space-y-6">
            {comments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">暂无评论,来发表第一条评论吧!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-200 dark:border-gray-700 pb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2F5D50] flex items-center justify-center text-white font-bold">
                      {comment.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[#1a1a1a] dark:text-[#E8E4D9]">
                          {comment.user.username}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(comment.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>

                      {/* 回复 */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-4">
                          {comment.replies.map((reply) => (
                            <div key={reply.id}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-[#1a1a1a] dark:text-[#E8E4D9]">
                                  {reply.user.username}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {new Date(reply.createdAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
