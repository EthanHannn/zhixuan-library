"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchVotes();
    }
  }, [status, router]);

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
    <div className="min-h-screen bg-[#F2F2EB] dark:bg-[#1C1C1E]">
      {/* 头部导航 */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-[#2F5D50] hover:underline">
            ← 返回首页
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            登出
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 用户信息 */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-8 mb-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-[#2F5D50] flex items-center justify-center text-white text-3xl font-bold">
              {((session.user as any)?.username || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9]">
                {(session.user as any)?.username}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{session.user?.email}</p>
              <p className="text-sm text-gray-500 mt-1">
                已投票 {votes.length} 本书
              </p>
            </div>
          </div>
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
