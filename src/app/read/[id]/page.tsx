"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "next/navigation";
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
  {
    id: "light", name: "月白", shell: "#E8EEF0", paper: "#F9FBFA", text: "#2A3438", title: "#2D6874",
    muted: "#708087", accent: "#397F8E", accentSoft: "#DCECEF", chrome: "rgba(249,251,250,0.94)", border: "#D4E0E2",
    quote: "#9B4F61", bracket: "#536F98", punctuation: "#3F837A", marker: "#BF5C68", number: "#95652D", english: "#75529A",
    selection: "#82B5C0", selectionText: "#152B30", shadow: "0 22px 60px rgba(56, 79, 84, 0.12)", dark: false,
  },
  {
    id: "sepia", name: "宣纸", shell: "#E7DDC7", paper: "#F7EFDF", text: "#4A3B31", title: "#9A642D",
    muted: "#887767", accent: "#A66C32", accentSoft: "#EEDFBE", chrome: "rgba(247,239,223,0.94)", border: "#DED0B5",
    quote: "#9B4141", bracket: "#506687", punctuation: "#47786F", marker: "#BE5C4B", number: "#89622E", english: "#76567C",
    selection: "#D4AD70", selectionText: "#3C2B1F", shadow: "0 22px 60px rgba(89, 66, 39, 0.14)", dark: false,
  },
  {
    id: "celadon", name: "青瓷", shell: "#D9E6DE", paper: "#EEF4EE", text: "#293A33", title: "#2E6A58",
    muted: "#6D7F76", accent: "#397B65", accentSoft: "#D3E6DA", chrome: "rgba(238,244,238,0.94)", border: "#C8DCCF",
    quote: "#985468", bracket: "#4E6C8A", punctuation: "#3A7C72", marker: "#B85D57", number: "#7E6A2D", english: "#69588D",
    selection: "#82B69E", selectionText: "#173126", shadow: "0 22px 60px rgba(48, 79, 64, 0.13)", dark: false,
  },
  {
    id: "peach", name: "桃雾", shell: "#F0E0E1", paper: "#FFF5F2", text: "#49363A", title: "#A14F65",
    muted: "#8B7478", accent: "#AD5D70", accentSoft: "#F2DDE1", chrome: "rgba(255,245,242,0.94)", border: "#E9D3D4",
    quote: "#A14848", bracket: "#5B6792", punctuation: "#4F8277", marker: "#C15465", number: "#8E6637", english: "#805484",
    selection: "#DCA2AD", selectionText: "#3D2228", shadow: "0 22px 60px rgba(109, 68, 77, 0.12)", dark: false,
  },
  {
    id: "ocean", name: "海夜", shell: "#0E1922", paper: "#172631", text: "#CBD9DE", title: "#79BECA",
    muted: "#8499A2", accent: "#69AEBB", accentSoft: "#233D48", chrome: "rgba(23,38,49,0.95)", border: "#29414D",
    quote: "#E2A0A8", bracket: "#92AED9", punctuation: "#72BCAF", marker: "#E6848F", number: "#D5B777", english: "#BE9BD2",
    selection: "#386D79", selectionText: "#F3F8FA", shadow: "0 24px 70px rgba(0, 0, 0, 0.28)", dark: true,
  },
  {
    id: "dark", name: "墨黑", shell: "#101214", paper: "#1B1E20", text: "#C9C4BA", title: "#D7AD70",
    muted: "#8D8A83", accent: "#C2965B", accentSoft: "#332C23", chrome: "rgba(27,30,32,0.96)", border: "#343536",
    quote: "#D68D82", bracket: "#8EA7CA", punctuation: "#70A99B", marker: "#DF7B75", number: "#C8AA68", english: "#B493C1",
    selection: "#725B3C", selectionText: "#FFF8EC", shadow: "0 24px 70px rgba(0, 0, 0, 0.35)", dark: true,
  },
] as const;

const THEME_KEY = "zx_reader_theme";
const FSIZE_KEY = "zx_reader_fontsize";
const COLORIZE_KEY = "zx_reader_colorize";
const PROGRESS_PREFIX = "zx_reading_";

type ReaderTheme = (typeof THEMES)[number];
type TokenKind = "text" | "quote" | "bracket" | "punctuation" | "marker" | "number" | "english";

const TOKEN_PATTERN = /([“”‘’"]|[（(【\[〔《〈]|[）)】\]〕》〉]|\d+(?:[.,]\d+)*|[A-Za-z]+(?:['’-][A-Za-z]+)*|[※★☆◆◇●○◎＊*#＃~～]+|[，。！？；：、,.!?;:…—·]+)/g;
const OPEN_QUOTES = new Set(["“", "‘"]);
const CLOSE_QUOTES = new Set(["”", "’"]);
const OPEN_BRACKETS = new Set(["（", "(", "【", "[", "〔", "《", "〈"]);
const CLOSE_BRACKETS = new Set(["）", ")", "】", "]", "〕", "》", "〉"]);
const MARKER_PATTERN = /^[※★☆◆◇●○◎＊*#＃~～]+$/;
const NUMBER_PATTERN = /^\d/;
const ENGLISH_PATTERN = /^[A-Za-z]/;
const PUNCTUATION_PATTERN = /^[，。！？；：、,.!?;:…—·]+$/;

function colorizeText(text: string, theme: ReaderTheme): ReactNode[] {
  const parts = text.split(TOKEN_PATTERN).filter(Boolean);
  let quoteDepth = 0;
  let bracketDepth = 0;

  return parts.map((part, index) => {
    let kind: TokenKind = "text";

    if (OPEN_QUOTES.has(part)) {
      kind = "punctuation";
      quoteDepth += 1;
    } else if (CLOSE_QUOTES.has(part)) {
      quoteDepth = Math.max(0, quoteDepth - 1);
      kind = "punctuation";
    } else if (part === '"') {
      quoteDepth = quoteDepth > 0 ? 0 : 1;
      kind = "punctuation";
    } else if (OPEN_BRACKETS.has(part)) {
      kind = "punctuation";
      bracketDepth += 1;
    } else if (CLOSE_BRACKETS.has(part)) {
      bracketDepth = Math.max(0, bracketDepth - 1);
      kind = "punctuation";
    } else if (quoteDepth > 0) {
      kind = "quote";
    } else if (bracketDepth > 0) {
      kind = "bracket";
    } else if (MARKER_PATTERN.test(part)) {
      kind = "marker";
    } else if (NUMBER_PATTERN.test(part)) {
      kind = "number";
    } else if (ENGLISH_PATTERN.test(part)) {
      kind = "english";
    } else if (PUNCTUATION_PATTERN.test(part)) {
      kind = "punctuation";
    }

    const color = kind === "text" ? undefined : theme[kind];
    return <span key={`${index}-${kind}`} style={color ? { color } : undefined}>{part}</span>;
  });
}

export default function ReaderPage() {
  const { id } = useParams();
  const { data: session } = useSession();

  const bookId = parseInt(id as string);
  const [book, setBook] = useState<{ title: string; author: string; chapterCount: number; hasContent: boolean } | null>(null);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [content, setContent] = useState<ContentResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(1);
  const [tocOpen, setTocOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [theme, setTheme] = useState<(typeof THEMES)[number]>(THEMES[0]);
  const [colorize, setColorize] = useState(true);
  const [inBookshelf, setInBookshelf] = useState(false);
  const [shelfLoading, setShelfLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化主题与字号
  useEffect(() => {
    const t = THEMES.find((x) => x.id === localStorage.getItem(THEME_KEY));
    if (t) setTheme(t);
    const fs = parseInt(localStorage.getItem(FSIZE_KEY) || "");
    if (!isNaN(fs) && fs >= 14 && fs <= 30) setFontSize(fs);
    setColorize(localStorage.getItem(COLORIZE_KEY) !== "false");
  }, []);

  useEffect(() => {
    if (!session?.user || !Number.isFinite(bookId)) return;
    fetch(`/api/bookshelf?bookId=${bookId}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setInBookshelf(!!data?.inBookshelf))
      .catch(() => undefined);
  }, [bookId, session?.user]);

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
      else if (e.key === "Escape") {
        setTocOpen(false);
        setPaletteOpen(false);
      }
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

  const chooseTheme = (next: ReaderTheme) => {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next.id);
  };

  const toggleColorize = () => {
    setColorize((enabled) => {
      const next = !enabled;
      localStorage.setItem(COLORIZE_KEY, String(next));
      return next;
    });
  };

  const toggleBookshelf = async () => {
    if (!session?.user || shelfLoading) return;
    setShelfLoading(true);
    try {
      const response = await fetch(inBookshelf ? `/api/bookshelf?bookId=${bookId}` : "/api/bookshelf", {
        method: inBookshelf ? "DELETE" : "POST",
        headers: inBookshelf ? undefined : { "Content-Type": "application/json" },
        body: inBookshelf ? undefined : JSON.stringify({ bookId }),
      });
      if (response.ok) setInBookshelf((current) => !current);
    } finally {
      setShelfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.shell, color: theme.text }}>
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.accent }}></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.shell, color: theme.text }}>
        <div className="text-center">
          <p className="text-xl mb-4">书籍不存在</p>
          <Link href="/" className="hover:underline" style={{ color: theme.accent }}>返回首页</Link>
        </div>
      </div>
    );
  }

  const paragraphs = content ? content.content.split(/\r?\n{2,}/).map((p) => p.replace(/\r?\n/g, "")).filter((p) => p.trim().length > 0) : [];
  const total = book.chapterCount;
  const chapterProgress = total > 0 ? (currentIdx / total) * 100 : 0;
  const readerStyle = {
    background: theme.shell,
    color: theme.text,
    "--reader-selection": theme.selection,
    "--reader-selection-text": theme.selectionText,
  } as CSSProperties;

  return (
    <div className="reader-root flex h-screen overflow-hidden transition-colors duration-300" style={readerStyle}>
      {/* 顶栏 */}
      <header
        className="fixed top-0 left-0 right-0 z-30 border-b flex items-center gap-1 px-2 sm:gap-2 sm:px-5 h-14 backdrop-blur-xl"
        style={{ background: theme.chrome, borderColor: theme.border }}
      >
        <Link href={`/book/${bookId}`} className="shrink-0 rounded-full px-2.5 py-1.5 text-sm transition-opacity hover:opacity-65">← <span className="hidden sm:inline">详情</span></Link>
        <Link href={`/book/${bookId}`} className="min-w-0 flex-1 truncate text-center text-sm font-bold transition-opacity hover:opacity-65 sm:text-base" style={{ color: theme.title }} title="返回小说详情">{book.title}</Link>
        <button
          type="button"
          onClick={toggleBookshelf}
          disabled={shelfLoading || !session?.user}
          className="shrink-0 rounded-full border px-2 py-1.5 text-xs font-bold transition-opacity hover:opacity-75 disabled:opacity-45 sm:px-3 sm:text-sm"
          style={{ borderColor: inBookshelf ? theme.accent : theme.border, background: theme.accentSoft, color: theme.accent }}
          title={inBookshelf ? "从书架移出" : "加入书架"}
        >{shelfLoading ? "…" : inBookshelf ? "✓ 已加" : "+ 书架"}</button>
        <button
          type="button"
          onClick={() => { setTocOpen(!tocOpen); setPaletteOpen(false); }}
          className="shrink-0 rounded-full border px-3 py-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ borderColor: theme.border, background: theme.paper }}
          title="打开目录"
        >目录</button>
        <button type="button" onClick={() => changeFontSize(-2)} className="hidden md:block shrink-0 rounded-full px-2 py-1.5 text-sm hover:opacity-70" title="减小字号">A−</button>
        <button type="button" onClick={() => changeFontSize(2)} className="hidden md:block shrink-0 rounded-full px-2 py-1.5 text-sm hover:opacity-70" title="增大字号">A＋</button>
        <button
          type="button"
          onClick={() => { setPaletteOpen(!paletteOpen); setTocOpen(false); }}
          className="shrink-0 flex items-center gap-2 rounded-full border px-2.5 sm:px-3 py-1.5 text-sm transition-opacity hover:opacity-75"
          style={{ borderColor: theme.border, background: theme.accentSoft, color: theme.accent }}
          aria-expanded={paletteOpen}
          title={`当前配色：${theme.name}`}
        >
          <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
            <span className="size-1.5 rounded-full" style={{ background: theme.quote }} />
            <span className="size-1.5 rounded-full" style={{ background: theme.bracket }} />
            <span className="size-1.5 rounded-full" style={{ background: theme.number }} />
            <span className="size-1.5 rounded-full" style={{ background: theme.punctuation }} />
          </span>
          <span className="hidden sm:inline">{theme.name}</span>
        </button>
      </header>

      <div className="fixed top-14 left-0 right-0 z-30 h-0.5" style={{ background: theme.border }} aria-hidden="true">
        <div className="h-full transition-[width] duration-500" style={{ width: `${chapterProgress}%`, background: theme.accent }} />
      </div>

      {/* 配色面板 */}
      {paletteOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setPaletteOpen(false)} aria-label="关闭配色面板" />
          <section
            className="fixed top-[4.25rem] right-3 z-50 w-[min(23rem,calc(100vw-1.5rem))] rounded-3xl border p-4 sm:p-5 shadow-2xl backdrop-blur-xl"
            style={{ background: theme.chrome, borderColor: theme.border, boxShadow: theme.shadow }}
            aria-label="阅读配色"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold" style={{ color: theme.title }}>阅读配色</h2>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: theme.muted }}>从背景到正文高亮整套切换，设置会保存在当前浏览器。</p>
              </div>
              <button type="button" onClick={() => setPaletteOpen(false)} className="rounded-full px-2 py-1 hover:opacity-60" aria-label="关闭">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((item) => {
                const selected = item.id === theme.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => chooseTheme(item)}
                    className="rounded-2xl border p-3 text-left transition-transform hover:-translate-y-0.5"
                    style={{
                      background: item.paper,
                      color: item.text,
                      borderColor: selected ? item.accent : item.border,
                      boxShadow: selected ? `0 0 0 1px ${item.accent}` : "none",
                    }}
                    aria-pressed={selected}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-bold">
                      {item.name}
                      {selected && <span style={{ color: item.accent }}>✓</span>}
                    </span>
                    <span className="mt-2.5 flex gap-1" aria-hidden="true">
                      {[item.title, item.quote, item.bracket, item.punctuation, item.number, item.english].map((color) => (
                        <span key={color} className="h-1.5 flex-1 rounded-full" style={{ background: color }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: theme.border, background: theme.paper }}>
              <button type="button" onClick={toggleColorize} className="flex w-full items-center justify-between gap-4 text-left" aria-pressed={colorize}>
                <span>
                  <span className="block text-sm font-bold" style={{ color: theme.title }}>彩色正文</span>
                  <span className="mt-0.5 block text-xs" style={{ color: theme.muted }}>轻量区分引号、括号、数字与英文</span>
                </span>
                <span
                  className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                  style={{ background: colorize ? theme.accent : theme.border }}
                  aria-hidden="true"
                >
                  <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]" style={{ left: colorize ? "1.375rem" : "0.125rem" }} />
                </span>
              </button>
              <div className="mt-3 flex gap-1.5 text-xs" aria-hidden="true">
                <span style={{ color: colorize ? theme.quote : theme.text }}>“对白”</span>
                <span style={{ color: colorize ? theme.bracket : theme.text }}>（注释）</span>
                <span style={{ color: colorize ? theme.number : theme.text }}>2026</span>
                <span style={{ color: colorize ? theme.english : theme.text }}>Color</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border px-3 py-2.5" style={{ borderColor: theme.border }}>
              <span className="text-sm" style={{ color: theme.muted }}>正文字号</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => changeFontSize(-2)} className="size-8 rounded-full border text-sm hover:opacity-70" style={{ borderColor: theme.border }} aria-label="减小字号">A−</button>
                <span className="w-10 text-center text-xs tabular-nums" style={{ color: theme.muted }}>{fontSize}px</span>
                <button type="button" onClick={() => changeFontSize(2)} className="size-8 rounded-full border text-sm hover:opacity-70" style={{ borderColor: theme.border }} aria-label="增大字号">A＋</button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* 目录抽屉 */}
      {tocOpen && (
        <div className="fixed inset-0 z-40 flex">
          <aside className="w-80 max-w-[86vw] h-full overflow-y-auto border-r shadow-2xl" style={{ background: theme.paper, borderColor: theme.border }}>
            <div className="sticky top-0 flex items-center justify-between px-4 py-4 border-b backdrop-blur-xl" style={{ borderColor: theme.border, background: theme.chrome }}>
              <span className="font-bold" style={{ color: theme.title }}>目录（{chapters.length}）</span>
              <button type="button" onClick={() => setTocOpen(false)} className="rounded-full px-2 py-1 hover:opacity-70" aria-label="关闭目录">✕</button>
            </div>
            <div className="py-2">
              {chapters.map((ch) => (
                <button
                  type="button"
                  key={ch.idx}
                  onClick={() => { setCurrentIdx(ch.idx); setTocOpen(false); }}
                  className="block w-full text-left px-4 py-2.5 text-sm truncate transition-opacity hover:opacity-75"
                  style={ch.idx === currentIdx ? { background: theme.accentSoft, color: theme.accent, fontWeight: 700 } : { color: theme.text }}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </aside>
          <button type="button" className="flex-1 cursor-default" style={{ background: theme.dark ? "rgba(0,0,0,0.55)" : "rgba(35,42,40,0.24)" }} onClick={() => setTocOpen(false)} aria-label="关闭目录" />
        </div>
      )}

      {/* 正文滚动区 */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto pt-14">
        {!book.hasContent ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center text-lg" style={{ color: theme.muted }}>本书暂无本地正文文件</div>
          </div>
        ) : contentLoading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: theme.accent }}></div>
          </div>
        ) : content ? (
          <div className="mx-auto max-w-4xl px-0 py-0 sm:px-6 sm:py-8 lg:py-12">
            <article
              className="font-serif min-h-[calc(100vh-3.5rem)] border-x px-6 py-10 sm:min-h-0 sm:rounded-[1.75rem] sm:border sm:px-12 sm:py-14 lg:px-16"
              style={{ background: theme.paper, borderColor: theme.border, boxShadow: theme.shadow, fontSize }}
            >
              <div className="mb-3 text-center text-xs tracking-[0.22em]" style={{ color: theme.muted }}>第 {content.idx} / {content.total} 章</div>
              <h1 className="text-center font-bold mb-10 leading-snug" style={{ color: theme.title, fontSize: fontSize + 7 }}>{content.title}</h1>
              {paragraphs.map((p, i) => (
                <p key={i} className="mb-5 leading-[2.05]" style={{ textIndent: "2em" }}>
                  {colorize ? colorizeText(p, theme) : p}
                </p>
              ))}
              <div className="mt-12 pb-6 text-center text-sm tracking-[0.2em]" style={{ color: theme.muted }}>— 本章完 —</div>
              <nav className="flex items-center justify-between border-t pt-6 gap-3" style={{ borderColor: theme.border }} aria-label="章节导航">
                <button
                  type="button"
                  onClick={() => setCurrentIdx((i) => Math.max(1, i - 1))}
                  disabled={!content.hasPrev}
                  className="px-4 py-2.5 rounded-full border hover:opacity-75 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  style={{ borderColor: theme.border, color: theme.accent, background: theme.accentSoft }}
                >← 上一章</button>
                <span className="hidden sm:inline text-xs tabular-nums" style={{ color: theme.muted }}>{Math.round(chapterProgress)}%</span>
                <button
                  type="button"
                  onClick={() => setCurrentIdx((i) => Math.min(total, i + 1))}
                  disabled={!content.hasNext}
                  className="px-4 py-2.5 rounded-full border hover:opacity-75 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  style={{ borderColor: theme.border, color: theme.accent, background: theme.accentSoft }}
                >下一章 →</button>
              </nav>
            </article>
          </div>
        ) : null}
      </main>
    </div>
  );
}
