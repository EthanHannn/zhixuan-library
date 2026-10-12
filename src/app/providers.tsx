"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReaderContext } from "@/lib/reader-types";

const CurrentReader = createContext<ReaderContext | null>(null);

export function useReader() {
  const data = useContext(CurrentReader);
  return { data, status: data ? "authenticated" : "unauthenticated" } as const;
}

export function Providers({ children, reader }: { children: React.ReactNode; reader: ReaderContext | null }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const expire = () => setExpired(true);
    const verify = () => {
      if (!document.hidden) fetch("/api/reader", { cache: "no-store", redirect: "manual" })
        .then(response => { if (response.status === 401 || response.type === "opaqueredirect") expire(); })
        .catch(() => undefined);
    };
    window.addEventListener("library:authentication-required", expire);
    window.addEventListener("pageshow", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      window.removeEventListener("library:authentication-required", expire);
      window.removeEventListener("pageshow", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, []);
  return <CurrentReader.Provider value={reader}>
    {expired && <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow">
      <span>登录已过期，阅读位置已暂存在此浏览器。</span>
      <button className="rounded border border-amber-800 px-3 py-1 font-semibold" onClick={() => window.location.reload()}>重新登录</button>
    </div>}
    {children}
  </CurrentReader.Provider>;
}
