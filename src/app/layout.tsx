import type { Metadata } from "next";
import { Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getCurrentReader } from "@/lib/auth";

const notoSerifSC = Noto_Serif_SC({
  weight: ["300", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-sc",
});

export const metadata: Metadata = {
  title: "知轩书房 · 私人高分藏书",
  description: "只为获准成员开放的私人高分小说书房",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reader = await getCurrentReader();
  return (
    <html lang="zh-CN">
      <body className={`${notoSerifSC.variable} antialiased`}>
        <Providers reader={reader}>{children}</Providers>
      </body>
    </html>
  );
}
