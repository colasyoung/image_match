import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getServerLocale } from "@/lib/i18n/server-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  if (locale === "en") {
    return {
      title: "Image Match — image popularity battles",
      description: "Anonymous 1v1 voting and a live popularity board.",
    };
  }
  return {
    title: "Image Match — 图片人气对战",
    description: "匿名 1v1 投票与实时人气榜",
  };
}

/** 不使用 next/font/google：在 Cloudflare Workers 等边缘运行时拉取 Google Fonts 易失败，导致整页无法渲染 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%)]" />
        <AppShell initialLocale={locale}>{children}</AppShell>
      </body>
    </html>
  );
}
