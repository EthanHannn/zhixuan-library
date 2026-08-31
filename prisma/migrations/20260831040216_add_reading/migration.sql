-- CreateTable
CREATE TABLE "chapters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "idx" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    CONSTRAINT "chapters_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "chapterIdx" INTEGER NOT NULL DEFAULT 1,
    "percent" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reading_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reading_progress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_books" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "tag1" TEXT NOT NULL,
    "tag2" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "xiancaoCount" INTEGER NOT NULL DEFAULT 0,
    "liangcaoCount" INTEGER NOT NULL DEFAULT 0,
    "gancaoCount" INTEGER NOT NULL DEFAULT 0,
    "kucaoCount" INTEGER NOT NULL DEFAULT 0,
    "ducaoCount" INTEGER NOT NULL DEFAULT 0,
    "submittedById" TEXT,
    "postId" INTEGER,
    "filePath" TEXT,
    "chapterCount" INTEGER NOT NULL DEFAULT 0,
    "hasContent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "books_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_books" ("author", "createdAt", "ducaoCount", "gancaoCount", "id", "intro", "kucaoCount", "liangcaoCount", "popularity", "score", "size", "status", "submittedById", "tag1", "tag2", "title", "totalScore", "updatedAt", "xiancaoCount") SELECT "author", "createdAt", "ducaoCount", "gancaoCount", "id", "intro", "kucaoCount", "liangcaoCount", "popularity", "score", "size", "status", "submittedById", "tag1", "tag2", "title", "totalScore", "updatedAt", "xiancaoCount" FROM "books";
DROP TABLE "books";
ALTER TABLE "new_books" RENAME TO "books";
CREATE INDEX "books_createdAt_idx" ON "books"("createdAt");
CREATE INDEX "books_score_idx" ON "books"("score");
CREATE INDEX "books_xiancaoCount_idx" ON "books"("xiancaoCount");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "chapters_bookId_idx_idx" ON "chapters"("bookId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_userId_bookId_key" ON "reading_progress"("userId", "bookId");
