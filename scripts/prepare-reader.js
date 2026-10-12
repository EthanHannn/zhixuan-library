/** Remove the retired password column without rebuilding books or chapters. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("users")');
  if (!columns.length) throw new Error("Initialize the database schema before starting");
  if (columns.some(column => column.name === "password")) {
    await prisma.$executeRawUnsafe('ALTER TABLE "users" DROP COLUMN "password"');
  }
  await prisma.user.upsert({
    where: { id: "default-reader" },
    update: {},
    create: { id: "default-reader", username: "default-reader", nickname: "我", role: "ADMIN" },
  });
  console.log("Default reader ready; book catalog and content preserved.");
}
main().catch(() => { console.error("Default reader initialization failed; server not started."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
