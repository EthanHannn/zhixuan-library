/** 生产构建认证冒烟测试：临时启动服务，验证页面、API、封面和真实登录。 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawn } = require("child_process");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const projectRoot = path.join(__dirname, "..");
const port = Number(process.env.AUTH_SMOKE_PORT || "3107");
const baseUrl = `http://127.0.0.1:${port}`;
const username = process.env.OWNER_USERNAME || "codingCat";
const password = process.env.OWNER_PASSWORD || "Think24";
const cookies = new Map();

function absorbCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(url, options = {}) {
  const response = await fetch(baseUrl + url, {
    redirect: "manual",
    ...options,
    headers: { ...(options.headers || {}), ...(cookies.size ? { Cookie: cookieHeader() } : {}) },
  });
  absorbCookies(response);
  return response;
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(baseUrl + "/login");
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("临时服务器启动超时");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const prisma = new PrismaClient();
  let testUserId = null;
  let testBookId = null;
  let createdShelfEntry = false;
  let createdProgress = false;
  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let serverError = "";
  server.stderr.on("data", (chunk) => { serverError += chunk.toString(); });

  try {
    await waitUntilReady();
    const login = await request("/login");
    const home = await request("/");
    const api = await request("/api/books");
    const cover = await request("/covers/real/1.jpg");
    const lazyCoverApi = await request("/api/books/1/cover", { method: "POST" });

    assert(login.status === 200, `登录页状态异常: ${login.status}`);
    assert(home.status >= 300 && home.status < 400, `未登录首页没有跳转: ${home.status}`);
    assert(api.status === 401, `未登录 API 没有返回 401: ${api.status}`);
    assert(cover.status >= 300 && cover.status < 400, `未登录封面没有被保护: ${cover.status}`);
    assert(lazyCoverApi.status === 401, `未登录懒封面接口没有返回 401: ${lazyCoverApi.status}`);

    const csrfResponse = await request("/api/auth/csrf");
    const { csrfToken } = await csrfResponse.json();
    const body = new URLSearchParams({ csrfToken, username, password, callbackUrl: baseUrl, json: "true" });
    await request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const sessionResponse = await request("/api/auth/session");
    const session = await sessionResponse.json();
    const authenticatedHome = await request("/");
    const categoriesResponse = await request("/api/categories");
    const categoryData = await categoriesResponse.json();
    const booksResponse = await request("/api/books?limit=1&onlyContent=1");
    const bookData = await booksResponse.json();
    const sampleBook = bookData.books?.[0];
    const wordFilterResponse = await request("/api/books?limit=5&onlyContent=1&minWords=1&maxWords=1000000&sortBy=words");
    const wordFilterData = await wordFilterResponse.json();
    const sampleCategory = categoryData.categories?.[0]?.name;
    const categoryFilterResponse = await request(`/api/books?limit=5&onlyContent=1&tag1=${encodeURIComponent(sampleCategory || "")}`);
    const categoryFilterData = await categoryFilterResponse.json();
    const similarResponse = await request(`/api/books/${sampleBook.id}/similar?limit=3`);
    const similarData = await similarResponse.json();
    const detailPage = await request(`/book/${sampleBook.id}`);
    const readerPage = await request(`/read/${sampleBook.id}`);
    assert(authenticatedHome.status === 200, `登录后首页不可访问: ${authenticatedHome.status}`);
    assert(categoriesResponse.status === 200, `登录后分类 API 不可访问: ${categoriesResponse.status}`);
    assert(booksResponse.status === 200 && sampleBook, "登录后无法取得书库样例");
    assert(categoryData.stats?.minScore === 7.5, "高分馆藏阈值不是 7.5");
    assert(Array.isArray(categoryData.subcategories), "书库缺少细分题材筛选数据");
    assert(sampleCategory, "一级分类数据为空");
    assert(typeof sampleBook.wordCount === "number", "书籍缺少 wordCount 字段");
    assert(wordFilterResponse.status === 200 && wordFilterData.books?.length, "篇幅筛选没有返回样例");
    assert(wordFilterData.books.every((book) => book.wordCount >= 1 && book.wordCount <= 1000000), "篇幅筛选返回了范围外作品");
    assert(wordFilterData.books.every((book, index, books) => index === 0 || books[index - 1].wordCount >= book.wordCount), "字数排序不正确");
    assert(categoryFilterResponse.status === 200 && categoryFilterData.books?.length && categoryFilterData.books.every((book) => book.tag1 === sampleCategory), "一级分类筛选不正确");
    assert(similarResponse.status === 200 && similarData.books?.length === 3, "相似作品推荐没有返回预期数量");
    assert(similarData.books.every((book) => book.id !== sampleBook.id), "相似作品推荐包含当前作品");
    assert(detailPage.status === 200, `作品详情页不可访问: ${detailPage.status}`);
    assert(readerPage.status === 200, `阅读页不可访问: ${readerPage.status}`);
    assert(session.user?.username === username, "会话用户名不匹配");
    assert(session.user?.nickname === "老板", "会话昵称不匹配");
    assert(session.user?.role === "ADMIN", "会话角色不是 ADMIN");
    testUserId = session.user.id;
    testBookId = sampleBook.id;

    const previousShelfResponse = await request(`/api/bookshelf?bookId=${sampleBook.id}`);
    const previousShelfState = await previousShelfResponse.json();
    assert(previousShelfResponse.status === 200, `读取原书架状态失败: ${previousShelfResponse.status}`);
    const previousProgressResponse = await request(`/api/books/${sampleBook.id}/progress`);
    const previousProgressState = await previousProgressResponse.json();
    assert(previousProgressResponse.status === 200, `读取原阅读进度失败: ${previousProgressResponse.status}`);

    const addShelfResponse = await request("/api/bookshelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: sampleBook.id }),
    });
    assert(addShelfResponse.status === 200, `加入书架失败: ${addShelfResponse.status}`);
    createdShelfEntry = !previousShelfState.inBookshelf;

    const expectedProgress = previousProgressState.progress || { chapterIdx: 1, percent: 0.125 };
    if (!previousProgressState.progress) {
      const saveProgressResponse = await request(`/api/books/${sampleBook.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expectedProgress),
      });
      assert(saveProgressResponse.status === 200, `保存阅读进度失败: ${saveProgressResponse.status}`);
      createdProgress = true;
    }

    const shelfStateResponse = await request(`/api/bookshelf?bookId=${sampleBook.id}`);
    const shelfState = await shelfStateResponse.json();
    assert(shelfState.inBookshelf === true, "书架状态没有保存");
    const shelfResponse = await request("/api/bookshelf");
    const shelfData = await shelfResponse.json();
    const shelfBook = shelfData.entries?.find((entry) => entry.book.id === sampleBook.id)?.book;
    assert(shelfResponse.status === 200 && shelfBook, "书架列表没有返回已加入的书");
    assert(shelfBook.progress?.chapterIdx === expectedProgress.chapterIdx, "书架没有关联阅读进度");
    const readingResponse = await request("/api/progress");
    const readingData = await readingResponse.json();
    assert(readingResponse.status === 200, `阅读记录接口失败: ${readingResponse.status}`);
    assert(readingData.progress?.some((entry) => entry.book.id === sampleBook.id), "阅读足迹没有保存测试进度");

    console.log(JSON.stringify({
      login: login.status,
      unauthenticatedHome: home.status,
      unauthenticatedApi: api.status,
      unauthenticatedCover: cover.status,
      authenticatedHome: authenticatedHome.status,
      visibleBooks: categoryData.stats.books,
      libraryFilters: { categories: categoryData.categories.length, subcategories: categoryData.subcategories.length },
      advancedFilterRoundTrip: true,
      similarRecommendations: similarData.books.length,
      detailAndReaderPages: true,
      bookshelfRoundTrip: true,
      readingProgressRoundTrip: true,
      session: { username: session.user.username, nickname: session.user.nickname, role: session.user.role },
    }, null, 2));
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (testUserId && testBookId) {
      if (createdShelfEntry) await prisma.bookshelfEntry.deleteMany({ where: { userId: testUserId, bookId: testBookId } });
      if (createdProgress) await prisma.readingProgress.deleteMany({ where: { userId: testUserId, bookId: testBookId } });
    }
    await prisma.$disconnect();
    if (serverError.trim()) console.error(serverError.trim());
  }
}

main().catch((error) => {
  console.error("认证冒烟测试失败:", error);
  process.exitCode = 1;
});
