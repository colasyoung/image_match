import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Image Match — 图片人气对战",
  description: "匿名 1v1 投票与实时人气榜",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-foreground">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%)]" />
        <nav className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-sm font-medium tracking-wide text-white/90">
              Image Match
            </Link>
            <Link
              href="/create"
              className="rounded-lg bg-cyan-400/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-300"
            >
              创建
            </Link>
          </div>
        </nav>
        <main className="relative z-10 flex-1">{children}</main>
      </body>
    </html>
  );
}
