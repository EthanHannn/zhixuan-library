import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const registerSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符").max(20, "用户名最多20个字符"),
  nickname: z.string().min(1, "昵称不能为空").max(30, "昵称最多30个字符"),
  password: z.string().min(8, "密码至少8个字符")
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "只有管理员可以创建成员" }, { status: 403 });
    }

    const body = await req.json();
    const { username, nickname, password } = registerSchema.parse(body);

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return NextResponse.json({ error: "用户名已被使用" }, { status: 400 });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        nickname,
        password: hashedPassword,
        role: "USER",
      }
    });

    return NextResponse.json({
      message: "注册成功",
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("注册失败:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
