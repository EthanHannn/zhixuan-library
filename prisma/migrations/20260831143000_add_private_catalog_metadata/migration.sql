-- AlterTable
ALTER TABLE "users" ADD COLUMN "nickname" TEXT;

-- AlterTable
ALTER TABLE "books" ADD COLUMN "coverPath" TEXT;
ALTER TABLE "books" ADD COLUMN "coverSource" TEXT;
ALTER TABLE "books" ADD COLUMN "coverSourceUrl" TEXT;
ALTER TABLE "books" ADD COLUMN "coverFetchedAt" DATETIME;
