const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('./prisma/dev.db');

async function main() {
  try {
    // 读取books.json
    const jsonContent = fs.readFileSync(path.join(__dirname, 'books_complete.json'), 'utf-8');
    // 移除末尾的分号
    const cleanJson = jsonContent.trim().replace(/;$/, '');
    const booksData = JSON.parse(cleanJson);

    console.log(`开始导入 ${booksData.length} 本书籍...`);

    const insert = db.prepare(`
      INSERT INTO books (
        title, author, tag1, tag2, size, intro,
        popularity, totalScore, score, status,
        xiancaoCount, liangcaoCount, gancaoCount, kucaoCount, ducaoCount,
        createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    let successCount = 0;
    let errorCount = 0;

    const now = new Date().toISOString();

    for (const book of booksData) {
      try {
        insert.run(
          book.title,
          book.author,
          book.tag1,
          book.tag2,
          book.size,
          book.intro,
          book.popularity,
          book.totalScore,
          book.score,
          'APPROVED',
          book.xiancao,
          book.liangcao,
          book.gancao,
          book.kucao,
          book.ducao,
          now,
          now
        );
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`已导入 ${successCount} 本书籍...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`导入书籍失败: ${book.title}`, error.message);
      }
    }

    console.log(`导入完成！成功: ${successCount}, 失败: ${errorCount}`);
  } catch (error) {
    console.error('导入过程出错:', error);
  } finally {
    db.close();
  }
}

main();
