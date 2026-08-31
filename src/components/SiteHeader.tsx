"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function SiteHeader() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-[#d8d0c0]/80 bg-[#f7f3ea]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#294e42] font-serif text-white shadow-md transition group-hover:-rotate-3">知</span>
            <span className="font-serif text-lg font-bold tracking-wide text-[#253a32]">知轩书房</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
            <Link href="/#categories" className="transition hover:text-[#9e4f38]">分类</Link>
            <Link href="/#library" className="transition hover:text-[#9e4f38]">馆藏</Link>
            <Link href="/profile" className="transition hover:text-[#9e4f38]">我的阅读</Link>
          </nav>
        </div>
        {session?.user && (
          <div className="flex items-center gap-2 sm:gap-3">
            {session.user.role === "ADMIN" && (
              <Link href="/register" className="hidden rounded-full px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:text-[#294e42] sm:block">添加成员</Link>
            )}
            <Link href="/profile" className="flex items-center gap-2 rounded-full border border-[#d8d0c0] bg-white/70 py-1.5 pl-1.5 pr-3 text-sm text-stone-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#b76043] font-serif text-xs font-bold text-white">
                {(session.user.nickname || session.user.username).slice(0, 1)}
              </span>
              <span className="hidden sm:inline">{session.user.nickname || session.user.username}</span>
            </Link>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="rounded-full px-3 py-2 text-sm text-stone-500 transition hover:bg-white hover:text-[#9e4f38]">退出</button>
          </div>
        )}
      </div>
    </header>
  );
}
