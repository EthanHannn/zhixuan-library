"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    nickname: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (formData.password.length < 8) {
      setError("密码至少需要8个字符");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: formData.username,
          nickname: formData.nickname,
          password: formData.password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("注册失败,请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#292722]">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-[1.75rem] border border-[#d9cfbf] bg-[#fffdf8] p-7 shadow-[0_22px_60px_rgba(55,45,35,0.08)] sm:p-9">
        <p className="text-center text-xs font-semibold tracking-[0.25em] text-[#9b4b35]">MEMBER ACCESS</p>
        <h1 className="mb-2 mt-3 text-center font-serif text-3xl font-bold text-[#263e35]">
          创建书库成员
        </h1>
        <p className="mb-7 text-center text-sm font-medium leading-6 text-[#6d665c]">为熟人创建登录账号，阅读记录、书架和评价会彼此独立。</p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#4d4841]">
              昵称
            </label>
            <input
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              required
              maxLength={30}
              className="w-full rounded-xl border border-[#d4c9b8] bg-white px-4 py-3 text-[#34312c] outline-none focus:border-[#315f50] focus:ring-4 focus:ring-[#315f50]/10"
              placeholder="成员在书库中显示的名字"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[#4d4841]">
              用户名
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={20}
              className="w-full rounded-xl border border-[#d4c9b8] bg-white px-4 py-3 text-[#34312c] outline-none focus:border-[#315f50] focus:ring-4 focus:ring-[#315f50]/10"
              placeholder="2-20个字符"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[#4d4841]">
              密码
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full rounded-xl border border-[#d4c9b8] bg-white px-4 py-3 text-[#34312c] outline-none focus:border-[#315f50] focus:ring-4 focus:ring-[#315f50]/10"
              placeholder="至少8个字符"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[#4d4841]">
              确认密码
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[#d4c9b8] bg-white px-4 py-3 text-[#34312c] outline-none focus:border-[#315f50] focus:ring-4 focus:ring-[#315f50]/10"
              placeholder="再次输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#315f50] py-3 font-semibold text-white transition hover:bg-[#284e42] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建成员"}
          </button>
        </form>

        <p className="mt-5 text-center">
          <Link href="/profile" className="text-sm font-semibold text-[#6d665c] hover:text-[#9b4b35]">
            ← 返回个人中心
          </Link>
        </p>
      </div>
      </main>
    </div>
  );
}
