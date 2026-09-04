import assert from "node:assert/strict";
import test from "node:test";
import { findDoubanCover, findQidianCover, findQqCover } from "./cover-sources";

const book = { title: "极道天魔", author: "滚开" };

test("起点搜索只接受书名和作者都匹配的记录", () => {
  const pageContext = {
    pageContext: {
      pageProps: {
        pageData: {
          bookInfo: {
            records: [
              { bid: 1, bName: "极道天魔", bAuth: "同名作者", imgUrl: "//example.com/1/180" },
              { bid: 1005401501, bName: "《极道天魔》", bAuth: "滚开", imgUrl: "//bookcover.yuewen.com/qdbimg/349573/1005401501/180" },
            ],
          },
        },
      },
    },
  };
  const html = `<script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify(pageContext)}</script>`;

  assert.deepEqual(findQidianCover(book, html), {
    source: "qidian",
    id: "1005401501",
    imageUrl: "https://bookcover.yuewen.com/qdbimg/349573/1005401501/300",
    referer: "https://m.qidian.com/",
  });
});

test("QQ 阅读从严格匹配的结果卡片生成 WebP 地址", () => {
  const html = `
    <a title="极道天魔" href="//book.qq.com/book-detail/56427334" class="wrap">
      <p class="other"><a href="//book.qq.com/book-writer/1">星月辰宇</a></p>
    </a>
    <a title="极道天魔" href="//book.qq.com/book-detail/15401501" class="wrap">
      <p class="other"><a href="//book.qq.com/book-writer/2">滚开</a></p>
    </a>`;

  assert.deepEqual(findQqCover(book, html), {
    source: "qq",
    id: "15401501",
    imageUrl: "https://wfqqreader-1252317822.image.myqcloud.com/cover/501/15401501/t7_15401501.webp",
    referer: "https://book.qq.com/",
  });
});

test("豆瓣也使用严格书名和作者匹配", () => {
  const suggestions = [
    { id: "wrong", title: "极道天魔", author_name: "同名作者", pic: "https://example.com/wrong.jpg" },
    { id: "right", title: "极道天魔", author_name: "滚开", pic: "https://example.com/right.jpg" },
  ];

  assert.equal(findDoubanCover(book, suggestions)?.id, "right");
  assert.equal(findDoubanCover({ title: "不存在", author: "滚开" }, suggestions), null);
});

test("起点结构化数据缺失时报告解析错误", () => {
  assert.throws(() => findQidianCover(book, "<html></html>"), /缺少结构化数据/);
});
