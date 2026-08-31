export function formatWordCount(wordCount: number, fallback = "字数待统计") {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return fallback;
  const tenThousands = wordCount / 10_000;
  const value = tenThousands >= 1000
    ? Math.round(tenThousands).toLocaleString("zh-CN")
    : tenThousands.toFixed(tenThousands < 100 ? 1 : 0).replace(/\.0$/, "");
  return `约 ${value} 万字`;
}

export function formatReadingPosition(chapterIdx: number, percent = 0) {
  return `第 ${chapterIdx} 章${percent > 0.02 ? ` · ${Math.round(percent * 100)}%` : ""}`;
}
