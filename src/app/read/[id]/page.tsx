"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ChapterInfo {
  idx: number;
  title: string;
}

interface ContentResp {
  idx: number;
  title: string;
  content: string;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const THEMES = [
  { id: "light", bg: "#F7F5EF", fg: "#2D2A26", title: "#1F1D1A", bar: "rgba(0,0,0,0.05)", name: "亮色" },
  { id: "sepia", bg: "#F3EAD8", fg: "#5B4636", title: "#3D2F24", bar: "rgba(0,0,0,0.06)", name: "羊皮纸" },
  { id: "dark", bg: "#1A1A1C", fg: "#B8B4AC", title: "#E0DCD4", bar: "rgba(255,255,255,0.06)", name: "夜间" },
] as const;

const THEME_KEY = "zx_reader_theme";
const FSIZE_KEY = "zx_reader_fontsize";
const PROGRESS_PREFIX = "zx_reading_";

export default function ReaderPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const bookId = parseInt(id as string);
  const [book, setBook] = useState<{ title: string; author: string; chapterCount: number; hasContent: boolean } | null>(null);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [content, setContent] = useState<ContentResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(1);
  const [tocOpen, setTocOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [theme, setTheme] = useState<(typeof THEMES)[number]>(THEMES[0]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<any>(null);

  // 初始化主题与字号
  useEffect(() => {
    const t = THEMES.find((x) => x.id === localStorage.getItem(THEME_KEY));
    if (t) setTheme(t);
    const fs = parseInt(localStorage.getItem(FSIZE_KEY) || "");
    if (!isNaN(fs) && fs >= 14 && fs <= 30) setFontSize(fs);
  }, []);

  // 加载书籍与目录
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/books/${bookId}/chapters`);
        const data = await res.json();
        setBook(data.book);
        setChapters(data.chapters || []);
        const qc = new URLSearchParams(window.location.search).get("c");
        const qcNum = qc ? parseInt(qc) : NaN;
        const startIdx = !isNaN(qcNum) && qcNum >= 1 && qcNum <= (data.book?.chapterCount || 0)
          ? qcNum
          : await resolveStartChapter(bookId, data.book?.chapterCount || 0);
        setCurrentIdx(startIdx);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const resolveStartChapter = async (bid: number, total: number) => {
    // 登录用户优先取云端进度，否则取本地进度
    try {
      const res = await fetch(`/api/books/${bid}/progress`);
      if (res.ok) {
        const { progress } = await res.json();
        if (progress) return Math.min(progress.chapterIdx, total || progress.chapterIdx);
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(PROGRESS_PREFIX + bid);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.chapterIdx) return Math.min(p.chapterIdx, total || p.chapterIdx);
      }
    } catch { /* ignore */ }
    return 1;
  };

  // 加载章节正文
  const loadChapter = useCallback(async (idx: number) => {
    setContentLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}/content?chapter=${idx}`);
      if (!res.ok) {
        const data = await res.json();
        setContent({ idx, title: "无法读取", content: data.error || "章节加载失败", total: book?.chapterCount || 0, hasPrev: idx > 1, hasNext: false });
        return;
      }
      const data = await res.json();
      setContent(data);
      setCurrentIdx(data.idx);
    } catch (e) {
      console.error(e);
    } finally {
      setContentLoading(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [bookId, book?.chapterCount]);

  // 章节变化时加载
  useEffect(() => {
    if (currentIdx >= 1 && book?.hasContent) loadChapter(currentIdx);
  }, [currentIdx, book?.hasContent, loadChapter]);

  // 保存进度（滚动节流 + 章节切换）
  const saveProgress = useCallback((idx: number, percent: number) => {
    const key = PROGRESS_PREFIX + bookId;
    try {
      localStorage.setItem(key, JSON.stringify({ chapterIdx: idx, percent, updatedAt: Date.now() }));
    } catch { /* ignore */ }
    if (session?.user) {
      fetch(`/api/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIdx: idx, percent }),
      }).catch(() => {});
    }
  }, [bookId, session]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const percent = max > 0 ? el.scrollTop / max : 0;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveProgress(currentIdx, percent), 800);
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [currentIdx, saveProgress]);

  // 恢复阅读位置（百分比滚动）
  useEffect(() => {
    if (!content) return;
    (async () => {
      let percent = 0;
      try {
        if (session?.user) {
          const res = await fetch(`/api/books/${bookId}/progress`);
          if (res.ok) {
            const { progress } = await res.json();
            if (progress && progress.chapterIdx === content.idx) percent = progress.percent;
          }
        }
      } catch { /* ignore */ }
      if (percent === 0) {
        try {
          const raw = localStorage.getItem(PROGRESS_PREFIX + bookId);
          if (raw) {
            const p = JSON.parse(raw);
            if (p.chapterIdx === content.idx) percent = p.percent || 0;
          }
        } catch { /* ignore */ }
      }
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el && percent > 0) {
          el.scrollTop = percent * (el.scrollHeight - el.clientHeight);
        }
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.idx]);

  // 键盘导航
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrentIdx((i) => Math.max(1, i - 1));
      else if (e.key === "ArrowRight") setCurrentIdx((i) => Math.min(book?.chapterCount || i, i + 1));
      else if (e.key === "Escape") setTocOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [book?.chapterCount]);

  const changeFontSize = (delta: number) => {
    setFontSize((s) => {
      const next = Math.min(30, Math.max(14, s + delta));
      localStorage.setItem(FSIZE_KEY, String(next));
      return next;
    });
  };

  const cycleTheme = () => {
    setTheme((t) => {
      const i = THEMES.findIndex((x) => x.id === t.id);
      const next = THEMES[(i + 1) % THEMES.length];
      localStorage.setItem(THEME_KEY, next.id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg, color: theme.fg }}>
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F5D50]"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.bg, color: theme.fg }}>
        <div className="text-center">
          <p className="text-xl mb-4">书籍不存在</p>
          <Link href="/" className="text-[#2F5D50] hover:underline">返回首页</Link>
        </div>
      </div>
    );
  }

  const paragraphs = content ? content.content.split(/\r?\n{2,}/).map((p) => p.replace(/\r?\n/g, "")).filter((p) => p.trim().length > 0) : [];
  const total = book.chapterCount;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: theme.bg, color: theme.fg }}>
      {/* 顶栏 */}
      <div className="fixed top-0 left-0 right-0 z-30 border-b flex items-center gap-3 px-4 h-12" style={{ background: theme.bg, borderColor: theme.bar }}>
        <Link href={`/book/${bookId}`} className="hover:opacity-70 text-sm">← 详情</Link>
        <span className="font-bold truncate flex-1 text-center" style={{ color: theme.title }}>{book.title}</span>
        <button onClick={() => setTocOpen(!tocOpen)} className="px-2 py-1 rounded hover:opacity-70 text-sm" title="目录">目录</button>
        <button onClick={() => changeFontSize(-2)} className="px-2 py-1 rounded hover:opacity-70 text-sm" title="减小字号">A-</button>
        <button onClick={() => changeFontSize(2)} className="px-2 py-1 rounded hover:opacity-70 text-sm" title="增大字号">A+</button>
        <button onClick={cycleTheme} className="px-2 py-1 rounded hover:opacity-70 text-sm" title={`主题: ${theme.name}`}>◐</button>
      </div>

      {/* 目录抽屉 */}
      {tocOpen && (
        <div className="fixed inset-0 z-40 flex" >
          <div className="w-72 max-w-[80vw] h-full overflow-y-auto border-r shadow-xl" style={{ background: theme.bg, borderColor: theme.bar }}>
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.bar, background: theme.bg }}>
              <span className="font-bold" style={{ color: theme.title }}>目录（{chapters.length}）</span>
              <button onClick={() => setTocOpen(false)} className="hover:opacity-70">✕</button>
            </div>
            <div className="py-2">
              {chapters.map((ch) => (
                <button
                  key={ch.idx}
                  onClick={() => { setCurrentIdx(ch.idx); setTocOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm truncate hover:opacity-80"
                  style={ch.idx === currentIdx ? { background: "rgba(47,93,80,0.12)", color: "#2F5D50", fontWeight: 700 } : undefined}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setTocOpen(false)} />
        </div>
      )}

      {/* 正文滚动区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-12">
        {!book.hasContent ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center text-lg opacity-70">本书暂无本地正文文件</div>
          </div>
        ) : contentLoading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#2F5D50]"></div>
          </div>
        ) : content ? (
          <div className="mx-auto px-6 py-8 max-w-3xl" style={{ fontSize }}>
            <h1 className="text-center font-bold mb-8" style={{ color: theme.title, fontSize: fontSize + 6 }}>{content.title}</h1>
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-4 leading-loose" style={{ textIndent: "2em" }}>{p}</p>
            ))}
            <div className="mt-10 pb-6 text-center opacity-60 text-sm">— 本章完 —</div>
            <div className="flex items-center justify-between py-4 gap-3">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(1, i - 1))}
                disabled={!content.hasPrev}
                className="px-4 py-2 rounded border hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                style={{ borderColor: theme.bar }}
              >← 上一章</button>
              <span className="text-sm opacity-60">第 {content.idx} / {content.total} 章</span>
              <button
                onClick={() => setCurrentIdx((i) => Math.min(total, i + 1))}
                disabled={!content.hasNext}
                className="px-4 py-2 rounded border hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                style={{ borderColor: theme.bar }}
              >下一章 →</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
