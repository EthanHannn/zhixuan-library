import type { Metadata } from "next";
import { Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const notoSerifSC = Noto_Serif_SC({
  weight: ["300", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-sc",
});

export const metadata: Metadata = {
  title: "知轩藏书 - 水墨写意",
  description: "知轩藏书排行榜 - 服务器版",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${notoSerifSC.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
