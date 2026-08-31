"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { SiteHeader } from "@/components/SiteHeader";

interface Vote {
  id: string;
  type: string;
  createdAt: string;
  book: {
    id: number;
    title: string;
    author: string;
  };
}

interface ReadingEntry {
  chapterIdx: number;
  percent: number;
  updatedAt: string;
  book: {
    id: number;
    title: string;
    author: string;
    tag1: string;
    hasContent: boolean;
    chapterCount: number;
    coverPath: string | null;
  };
}

const voteTypeLabels: Record<string, string> = {
  XIANCAO: "🌟 仙草",
  LIANGCAO: "🌾 粮草",
  GANCAO: "🌿 干草",
  KUCAO: "🍂 枯草",
  DUCAO: "☠️ 毒草"
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [reading, setReading] = useState<ReadingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchVotes();
      fetchReading();
    }
  }, [status, router]);

  const fetchReading = async () => {
    try {
      const res = await fetch("/api/progress");
      if (res.ok) {
        const data = await res.json();
        setReading(data.progress || []);
      }
    } catch (error) {
      console.error("获取最近阅读失败:", error);
    }
  };

  const fetchVotes = async () => {
    try {
      const res = await fetch("/api/votes");
      const data = await res.json();
      setVotes(data.votes || []);
    } catch (error) {
      console.error("获取投票记录失败:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#F2F2EB] dark:bg-[#1C1C1E] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F5D50]"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8]">
      <SiteHeader />

      <main className="container mx-auto px-4 py-8">
        {/* 用户信息 */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-[#2F5D50] flex items-center justify-center text-white text-3xl font-bold">
              {(session.user.nickname || session.user.username || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9]">
                {session.user.nickname || session.user.username}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                已投票 {votes.length} 本书
              </p>
            </div>
          </div>
        </div>

        {/* 最近阅读 */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9] mb-6">
            最近阅读
          </h2>

          {reading.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              还没有阅读记录,去 <Link href="/" className="text-[#2F5D50] hover:underline">首页</Link> 挑一本开始看吧!
            </p>
          ) : (
            <div className="space-y-3">
              {reading.map((r) => (
                <div
                  key={r.book.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <BookCover
                      id={r.book.id}
                      title={r.book.title}
                      coverPath={r.book.coverPath}
                      className="w-10 h-14 object-cover rounded shadow"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/book/${r.book.id}`}
                        className="font-medium text-[#1a1a1a] dark:text-[#E8E4D9] hover:text-[#2F5D50] transition line-clamp-1"
                      >
                        {r.book.title}
                      </Link>
                      <p className="text-sm text-gray-500 line-clamp-1"><Link href={`/author/${encodeURIComponent(r.book.author)}`} className="hover:underline">{r.book.author}</Link> · {r.book.tag1}</p>
                      <p className="text-xs text-gray-400">
                        读到第 {r.chapterIdx} 章{r.percent > 0.02 ? ` · ${Math.round(r.percent * 100)}%` : ""} ·{" "}
                        {new Date(r.updatedAt).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  {r.book.hasContent && (
                    <Link
                      href={`/read/${r.book.id}?c=${r.chapterIdx}`}
                      className="flex-shrink-0 px-4 py-2 bg-[#2F5D50] text-white text-sm rounded hover:bg-[#3d7766] transition"
                    >
                      继续阅读
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 投票记录 */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8">
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9] mb-6">
            我的投票记录
          </h2>

          {votes.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              还没有投票记录,去 <Link href="/" className="text-[#2F5D50] hover:underline">首页</Link> 看看吧!
            </p>
          ) : (
            <div className="space-y-4">
              {votes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <div>
                    <Link
                      href={`/book/${vote.book.id}`}
                      className="font-medium text-[#1a1a1a] dark:text-[#E8E4D9] hover:text-[#2F5D50] transition"
                    >
                      {vote.book.title}
                    </Link>
                    <p className="text-sm text-gray-500">{vote.book.author}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg">{voteTypeLabels[vote.type]}</span>
                    <p className="text-sm text-gray-500">
                      {new Date(vote.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
