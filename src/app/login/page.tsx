"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("用户名或密码错误");
      } else {
        const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
        router.push(callbackUrl || "/");
        router.refresh();
      }
    } catch {
      setError("登录失败,请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3efe5] px-4 text-stone-900">
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#b75d3e]/15 blur-3xl" />
      <div className="absolute -right-20 bottom-16 h-80 w-80 rounded-full bg-[#315b4c]/15 blur-3xl" />
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center lg:justify-between">
        <section className="hidden max-w-xl lg:block">
          <p className="mb-5 text-sm font-semibold tracking-[0.35em] text-[#9a4d33]">PRIVATE LIBRARY</p>
          <h1 className="font-serif text-6xl font-bold leading-[1.12] text-[#243b32]">
            一间只为熟人<br />亮灯的书房
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-stone-600">
            精选高分作品、完整章节与私人阅读进度，都收在门后。登录后，慢慢挑一本今晚想读的书。
          </p>
        </section>

        <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/75 p-8 shadow-[0_24px_80px_rgba(49,91,76,0.16)] backdrop-blur-xl sm:p-10">
          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#315b4c] font-serif text-xl text-white">知</div>
            <p className="text-sm tracking-[0.22em] text-[#9a4d33]">知轩藏书</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-[#243b32]">欢迎回到书房</h2>
            <p className="mt-2 text-sm text-stone-500">这是私人空间，请使用已授权账号进入。</p>
          </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-xl border border-stone-200 bg-white/80 px-4 py-3 outline-none transition focus:border-[#315b4c] focus:ring-4 focus:ring-[#315b4c]/10"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-stone-200 bg-white/80 px-4 py-3 outline-none transition focus:border-[#315b4c] focus:ring-4 focus:ring-[#315b4c]/10"
              placeholder="请输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#315b4c] py-3.5 font-medium text-white shadow-lg shadow-[#315b4c]/20 transition hover:-translate-y-0.5 hover:bg-[#274a3e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

          <p className="mt-6 text-center text-xs leading-5 text-stone-400">没有账号请联系书库管理员创建，本站不开放公开注册。</p>
        </div>
      </div>
    </div>
  );
}
