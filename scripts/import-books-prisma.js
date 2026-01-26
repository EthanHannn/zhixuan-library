/**
 * 使用 Prisma Client 导入书籍数据
 * 跨平台兼容 (Windows/Linux/Mac)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('开始导入书籍数据...');

    // 读取书籍数据
    const dataPath = path.join(__dirname, 'books_complete.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    
    // 移除末尾的分号
    const jsonData = rawData.trim().replace(/;$/, '');
    const books = JSON.parse(jsonData);

    console.log(`读取到 ${books.length} 本书籍数据`);

    // 批量导入 (每次100本)
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < books.length; i += batchSize) {
      const batch = books.slice(i, i + batchSize);
      
      await prisma.book.createMany({
        data: batch.map(book => ({
          title: book.title,
          author: book.author,
          tag1: book.tag1,
          tag2: book.tag2,
          size: book.size,
          intro: book.intro,
          popularity: book.popularity || 0,
          totalScore: book.totalScore || 0,
          score: book.score || 0,
          status: 'APPROVED',
          xiancaoCount: book.xiancaoCount || 0,
          liangcaoCount: book.liangcaoCount || 0,
          gancaoCount: book.gancaoCount || 0,
          kucaoCount: book.kucaoCount || 0,
          ducaoCount: book.ducaoCount || 0
        }))
      });

      imported += batch.length;
      console.log(`已导入 ${imported}/${books.length} 本书籍...`);
    }

    console.log('✅ 数据导入完成!');
    
    // 统计
    const total = await prisma.book.count();
    console.log(`数据库中共有 ${total} 本书籍`);

  } catch (error) {
    console.error('❌ 导入失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
