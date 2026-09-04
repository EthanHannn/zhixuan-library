const QIDIAN_PAGE_CONTEXT_PATTERN = /<script\s+id=["']vite-plugin-ssr_pageContext["'][^>]*>([\s\S]*?)<\/script>/i;
const QQ_CARD_PATTERN = /<a\s+title=["']([^"']*)["']\s+href=["']\/\/book\.qq\.com\/book-detail\/(\d+)["'][\s\S]*?<p\s+class=["'][^"']*\bother\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
const QQ_AUTHOR_PATTERN = /<a\s+href=["']\/\/book\.qq\.com\/book-writer\/[^"']+["'][^>]*>([^<]+)<\/a>/i;

function normalizeBookIdentity(value) {
  return String(value || "").toLowerCase().replace(/[《》〈〉（）()\[\]【】·:：,，.。\s_-]/g, "");
}

function identitiesMatch(book, title, author) {
  const wantedTitle = normalizeBookIdentity(book.title);
  const wantedAuthor = normalizeBookIdentity(book.author);
  return Boolean(
    wantedTitle
    && wantedAuthor
    && normalizeBookIdentity(title) === wantedTitle
    && normalizeBookIdentity(author) === wantedAuthor,
  );
}

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function absoluteHttpsUrl(value) {
  if (value.startsWith("//")) return `https:${value}`;
  return value.replace(/^http:\/\//i, "https://");
}

function findQidianCover(book, html) {
  const pageContextMatch = html.match(QIDIAN_PAGE_CONTEXT_PATTERN);
  if (!pageContextMatch) throw new Error("起点搜索页缺少结构化数据");

  const pageContext = JSON.parse(pageContextMatch[1]);
  const records = pageContext.pageContext?.pageProps?.pageData?.bookInfo?.records;
  if (!Array.isArray(records)) throw new Error("起点搜索页数据格式异常");

  const record = records.find((item) => identitiesMatch(book, item.bName, item.bAuth) && item.bid && item.imgUrl);
  if (!record?.bid || !record.imgUrl) return null;

  const imageUrl = absoluteHttpsUrl(record.imgUrl).replace(/\/180(?=\?|$)/, "/300");
  return { source: "qidian", id: String(record.bid), imageUrl, referer: "https://m.qidian.com/" };
}

function findQqCover(book, html) {
  for (const match of html.matchAll(new RegExp(QQ_CARD_PATTERN))) {
    const authorMatch = match[3].match(QQ_AUTHOR_PATTERN);
    const title = decodeHtml(match[1]);
    const author = authorMatch ? decodeHtml(authorMatch[1]).trim() : "";
    if (!identitiesMatch(book, title, author)) continue;

    const id = match[2];
    const folder = String(Number(id) % 1000);
    return {
      source: "qq",
      id,
      imageUrl: `https://wfqqreader-1252317822.image.myqcloud.com/cover/${folder}/${id}/t7_${id}.webp`,
      referer: "https://book.qq.com/",
    };
  }

  return null;
}

function findDoubanCover(book, suggestions) {
  const suggestion = suggestions.find((item) => (
    Boolean(item.id && item.pic)
    && identitiesMatch(book, item.title, item.author_name)
  ));
  if (!suggestion?.id || !suggestion.pic) return null;
  return { source: "douban", id: suggestion.id, imageUrl: suggestion.pic, referer: "https://book.douban.com/" };
}

module.exports = { findDoubanCover, findQidianCover, findQqCover, normalizeBookIdentity };
