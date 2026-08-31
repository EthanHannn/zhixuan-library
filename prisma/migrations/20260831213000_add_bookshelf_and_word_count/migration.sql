ALTER TABLE "books" ADD COLUMN "wordCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "bookshelf_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bookshelf_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookshelf_entries_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "bookshelf_entries_userId_bookId_key" ON "bookshelf_entries"("userId", "bookId");
CREATE INDEX "bookshelf_entries_userId_addedAt_idx" ON "bookshelf_entries"("userId", "addedAt");
CREATE INDEX "books_wordCount_idx" ON "books"("wordCount");
