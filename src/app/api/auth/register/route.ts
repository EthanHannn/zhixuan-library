import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  username: z.string().min(2, "用户名至少2个字符").max(20, "用户名最多20个字符"),
  password: z.string().min(6, "密码至少6个字符")
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, password } = registerSchema.parse(body);

    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingEmail) {
      return NextResponse.json({ error: "邮箱已被注册" }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return NextResponse.json({ error: "用户名已被使用" }, { status: 400 });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      }
    });

    return NextResponse.json({
      message: "注册成功",
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("注册失败:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
