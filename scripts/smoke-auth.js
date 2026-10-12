/** Isolated real-server authentication and business-data regression test. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "zhixuan-auth-"));
const origin = "https://library.private.example.test";
const env = { ...process.env, DATABASE_URL: `file:${path.join(fixture, "fixture.db").replaceAll("\\", "/")}`, NOVEL_ROOT: fixture, COVER_ROOT: fixture, COVER_AUTO_FETCH: "false", PORTAL_ALLOWED_USER: "owner", LIBRARY_PUBLIC_URL: origin, PORTAL_AUTH_URL: "https://auth.private.example.test", NODE_ENV: "production", PORT: "16870", HOSTNAME: "127.0.0.1" };
let server;
let container = false;
const image = process.env.AUTH_TEST_IMAGE;
function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`Fixture command failed: ${script}\n${result.stderr}`);
}
async function request(url, { trusted = true, method = "GET", body, headers = {} } = {}) {
  return fetch(`http://127.0.0.1:16870${url}`, { method, redirect: "manual", headers: { ...(trusted ? { "Remote-User": "owner" } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { Origin: origin } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
}
async function main() {
  runNode("node_modules/prisma/build/index.js", ["db", "push", "--skip-generate"]);
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    const text = "第一章 初见\n\n用于集成测试的正文。\n\n第二章 继续\n\n阅读位置应正确保存。";
    fs.writeFileSync(path.join(fixture, "sample.txt"), text);
    const split = Buffer.byteLength(text.slice(0, text.indexOf("第二章")));
    await db.book.create({ data: { id: 1, title: "认证回归样本", author: "测试", tag1: "玄幻", tag2: "测试", size: "1万字", intro: "独立测试书库", status: "APPROVED", score: 9, hasContent: true, chapterCount: 2, filePath: "sample.txt", chapters: { create: [{ idx: 1, title: "初见", startOffset: 0, endOffset: split }, { idx: 2, title: "继续", startOffset: split, endOffset: Buffer.byteLength(text) }] } } });
    // Exercise the old-schema transition without using anyone's actual database.
    await db.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN "password" TEXT');
    runNode("scripts/prepare-reader.js");
    runNode("scripts/prepare-reader.js");
    const columns = await db.$queryRawUnsafe('PRAGMA table_info("users")');
    assert(!columns.some(c => c.name === "password"));
    assert.equal(await db.book.count(), 1);
    assert.equal(await db.chapter.count(), 2);
  } finally { await db.$disconnect(); }
  if (image) {
    const args = ["run", "--detach", "--rm", "--name", `zhixuan-auth-${process.pid}`, "-p", "127.0.0.1:16870:3000", "-v", `${fixture}:/app/data`, "-v", `${fixture}:/data/novels:ro`, "-e", "DATABASE_URL=file:/app/data/fixture.db", "-e", "NOVEL_ROOT=/data/novels", "-e", "COVER_AUTO_FETCH=false", "-e", "PORTAL_ALLOWED_USER=owner", "-e", `LIBRARY_PUBLIC_URL=${origin}`, "-e", "PORTAL_AUTH_URL=https://auth.private.example.test", image];
    const result = spawnSync("docker", args, { encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr); container = true;
  } else {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "16870"], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    server.stdout.on("data", () => {}); server.stderr.on("data", () => {});
  }
  for (let i = 0; i < 100; i++) {
    try { if ((await request("/api/health", { trusted: false })).ok) break; } catch { /* wait for server */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal((await request("/api/health", { trusted: false })).status, 200);
  for (const url of ["/", "/api/books", "/api/categories", "/api/books/1/content?chapter=1", "/api/bookshelf", "/api/progress", "/api/comments?bookId=1", "/covers/1.svg", "/_next/image?url=%2Fcovers%2F1.svg&w=640&q=75"]) {
    assert.equal((await request(url, { trusted: false, headers: { Cookie: "next-auth.session-token=retired", "X-Forwarded-User": "owner" } })).status, 401, url);
  }
  assert.equal((await request("/api/books", { headers: { "Remote-User": "stranger" } })).status, 403);
  assert.equal((await request("/api/reader")).status, 200);
  const reader = await (await request("/api/reader")).json();
  assert.equal(reader.user.id, "default-reader"); assert.equal(reader.logoutUrl, "https://auth.private.example.test/logout");
  assert.equal((await request("/login?callbackUrl=https://evil.test")).headers.get("location"), "/");
  assert.equal((await request("/api/auth/session")).status, 410);
  assert.equal((await request("/api/auth/callback/credentials", { method: "POST", body: {} })).status, 410);
  assert.equal((await request("/api/books/1/content?chapter=1")).status, 200);
  assert.equal((await request("/api/bookshelf", { method: "POST", body: { bookId: 1 }, headers: { Origin: "https://blog.private.example.test" } })).status, 403);
  assert.equal((await request("/api/bookshelf", { method: "POST", body: { bookId: 1 }, headers: { "Content-Type": "text/plain" } })).status, 415);
  assert.equal((await request("/api/bookshelf", { method: "POST", body: { bookId: 1, userId: "forged" } })).status, 200);
  assert.equal((await request("/api/books/1/progress", { method: "POST", body: { chapterIdx: 2, percent: 0.42, userId: "forged" } })).status, 200);
  const progress = await (await request("/api/books/1/progress")).json();
  assert.equal(progress.progress.chapterIdx, 2); assert.equal(progress.progress.userId, "default-reader");
  assert.equal((await request("/api/comments", { method: "POST", body: { bookId: 1, content: "测试评论", userId: "forged" } })).status, 200);
  assert.equal((await request("/api/votes", { method: "POST", body: { bookId: 1, type: "XIANCAO", userId: "forged" } })).status, 200);
  assert.equal((await request("/api/bookshelf?bookId=1", { method: "DELETE" })).status, 200);
  console.log("PASS: schema transition, anonymous/forged identity, retired login, content, origin/JSON policy, shelf, progress, comment and vote ownership.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (server) { server.kill(); await new Promise(resolve => server.once("close", resolve)); }
  if (container) spawnSync("docker", ["stop", `zhixuan-auth-${process.pid}`], { stdio: "ignore", windowsHide: true });
  if (path.dirname(path.resolve(fixture)) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith("zhixuan-auth-")) fs.rmSync(fixture, { recursive: true, force: true });
});
