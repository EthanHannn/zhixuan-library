/**
 * 创建私有书库的初始管理员。重复执行不会重置已有账号密码；如需覆盖密码，
 * 显式传入 --reset-password。
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const username = process.env.OWNER_USERNAME || "codingCat";
const password = process.env.OWNER_PASSWORD || "Think24";
const nickname = process.env.OWNER_NICKNAME || "老板";
const resetPassword = process.argv.includes("--reset-password");

async function main() {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const data = { nickname, role: "ADMIN" };
    if (resetPassword) data.password = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { username }, data });
    console.log(`管理员 ${username} 已存在，已同步昵称和权限${resetPassword ? "并重置密码" : ""}。`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      nickname,
      role: "ADMIN",
      password: await bcrypt.hash(password, 12),
    },
  });
  console.log(`初始管理员 ${username} 已创建。`);
}

main()
  .catch((error) => {
    console.error("创建初始管理员失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
