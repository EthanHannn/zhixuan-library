import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import * as fs from "fs";
import * as path from "path";

const libsql = createClient({
  url: 'file:./prisma/dev.db'
});

const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    // 读取books.json
    const booksData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "books.json"), "utf-8")
    );

    console.log(`开始导入 ${booksData.length} 本书籍...`);

    let successCount = 0;
    let errorCount = 0;

    for (const book of booksData) {
      try {
        await prisma.book.create({
          data: {
            title: book.title,
            author: book.author,
            tag1: book.tag1,
            tag2: book.tag2,
            size: book.size,
            intro: book.intro,
            popularity: book.popularity,
            totalScore: book.totalScore,
            score: book.score,
            xiancaoCount: book.xiancao,
            liangcaoCount: book.liangcao,
            gancaoCount: book.gancao,
            kucaoCount: book.kucao,
            ducaoCount: book.ducao,
            status: "APPROVED"  // 现有数据直接通过
          }
        });
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`已导入 ${successCount} 本书籍...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`导入书籍失败: ${book.title}`, error);
      }
    }

    console.log(`导入完成！成功: ${successCount}, 失败: ${errorCount}`);
  } catch (error) {
    console.error("导入过程出错:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
