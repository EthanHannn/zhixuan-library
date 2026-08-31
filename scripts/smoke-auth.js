/** 生产构建认证冒烟测试：临时启动服务，验证页面、API、封面和真实登录。 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawn } = require("child_process");
const path = require("path");

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

    assert(login.status === 200, `登录页状态异常: ${login.status}`);
    assert(home.status >= 300 && home.status < 400, `未登录首页没有跳转: ${home.status}`);
    assert(api.status === 401, `未登录 API 没有返回 401: ${api.status}`);
    assert(cover.status >= 300 && cover.status < 400, `未登录封面没有被保护: ${cover.status}`);

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
    assert(authenticatedHome.status === 200, `登录后首页不可访问: ${authenticatedHome.status}`);
    assert(categoriesResponse.status === 200, `登录后分类 API 不可访问: ${categoriesResponse.status}`);
    assert(categoryData.stats?.minScore === 7.5, "高分馆藏阈值不是 7.5");
    assert(session.user?.username === username, "会话用户名不匹配");
    assert(session.user?.nickname === "老板", "会话昵称不匹配");
    assert(session.user?.role === "ADMIN", "会话角色不是 ADMIN");

    console.log(JSON.stringify({
      login: login.status,
      unauthenticatedHome: home.status,
      unauthenticatedApi: api.status,
      unauthenticatedCover: cover.status,
      authenticatedHome: authenticatedHome.status,
      visibleBooks: categoryData.stats.books,
      session: { username: session.user.username, nickname: session.user.nickname, role: session.user.role },
    }, null, 2));
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    if (serverError.trim()) console.error(serverError.trim());
  }
}

main().catch((error) => {
  console.error("认证冒烟测试失败:", error);
  process.exitCode = 1;
});
