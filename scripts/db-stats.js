require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const [books, withContent, chapters] = await Promise.all([
    p.book.count(),
    p.book.count({ where: { hasContent: true } }),
    p.chapter.count(),
  ]);
  console.log("books:", books, "| withContent:", withContent, "| chapters:", chapters);
  const sample = await p.book.findFirst({
    where: { hasContent: true },
    include: { _count: { select: { chapters: true } } },
  });
  console.log("sample:", sample.title, "/", sample.author, "chapters:", sample._count.chapters);
  console.log("file:", sample.filePath);
  const c1 = await p.chapter.findFirst({ where: { bookId: sample.id, idx: 1 } });
  console.log("first chapter:", JSON.stringify(c1.title), "offsets:", c1.startOffset, "->", c1.endOffset);
  const last = await p.chapter.findFirst({ where: { bookId: sample.id }, orderBy: { idx: "desc" } });
  console.log("last chapter:", JSON.stringify(last.title), "idx:", last.idx);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
