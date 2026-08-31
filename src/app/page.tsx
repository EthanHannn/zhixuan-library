"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

interface Book {
  id: number;
  title: string;
  author: string;
  tag1: string;
  tag2: string;
  score: number;
  xiancaoCount: number;
  ducaoCount: number;
  size: string;
  popularity: number;
  hasContent: boolean;
  chapterCount: number;
}

export default function Home() {
  const { data: session } = useSession();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("score");
  const [search, setSearch] = useState("");
  const [onlyContent, setOnlyContent] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchBooks();
  }, [sortBy, search, page, onlyContent]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        search,
        page: page.toString(),
        limit: "24",
        onlyContent: onlyContent ? "1" : "0"
      });
      const res = await fetch(`/api/books?${params}`);
      const data = await res.json();
      setBooks(data.books);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("获取书籍失败:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2EB] dark:bg-[#1C1C1E]">
      {/* 头部 */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-[#1a1a1a] dark:text-[#E8E4D9]">
              知轩藏书
            </h1>
            <div className="flex gap-4 items-center">
              {session ? (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    欢迎, {(session.user as any)?.username}
                  </span>
                  <Link
                    href="/profile"
                    className="px-4 py-2 bg-[#2F5D50] text-white rounded hover:bg-[#3d7766] transition"
                  >
                    个人中心
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    登出
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-[#2F5D50] text-white rounded hover:bg-[#3d7766] transition"
                  >
                    注册
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* 搜索和筛选 */}
          <div className="mt-6 flex gap-4 flex-wrap items-center">
            <input
              type="text"
              placeholder="搜索书名或作者..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2F5D50] dark:bg-gray-800 dark:border-gray-600"
            />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2F5D50] dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="score">综合评分</option>
              <option value="xiancao">仙草数量</option>
              <option value="popularity">人气</option>
              <option value="latest">最新添加</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyContent}
                onChange={(e) => {
                  setOnlyContent(e.target.checked);
                  setPage(1);
                }}
                className="accent-[#2F5D50]"
              />
              只看有正文
            </label>
          </div>
        </div>
      </header>

      {/* 书籍列表 */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F5D50]"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
                >
                  <div className="flex gap-4">
                    {/* 封面 */}
                    <Link href={`/book/${book.id}`} className="flex-shrink-0">
                      <img
                        src={`/covers/${book.id}.svg`}
                        alt={book.title}
                        className="w-20 h-28 object-cover rounded shadow-md"
                        loading="lazy"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/book/${book.id}`}>
                        <h3 className="font-bold text-[#1a1a1a] dark:text-[#E8E4D9] hover:text-[#2F5D50] dark:hover:text-[#5A9A85] transition line-clamp-1">
                          {book.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                        {book.author} · {book.tag1} · {book.tag2}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                        <span className="text-[#2F5D50] dark:text-[#5A9A85]">
                          ⭐ {book.score.toFixed(1)}
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          🌟 {book.xiancaoCount}
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          ☠️ {book.ducaoCount}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {book.size}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {book.hasContent ? (
                          <Link
                            href={`/read/${book.id}`}
                            className="flex-1 text-center px-3 py-1.5 bg-[#2F5D50] text-white text-sm rounded hover:bg-[#3d7766] transition"
                          >
                            开始阅读
                          </Link>
                        ) : (
                          <span className="flex-1 text-center px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm rounded cursor-not-allowed">
                            暂无正文
                          </span>
                        )}
                        <Link
                          href={`/book/${book.id}`}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        >
                          详情
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                上一页
              </button>
              <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                下一页
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
