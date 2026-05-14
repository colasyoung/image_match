import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co", pathname: "/**" },
      { protocol: "https", hostname: "image.ibb.co", pathname: "/**" },
    ],
  },
};

export default nextConfig;

// Vercel 构建与运行时会设置 VERCEL=1；此处跳过 OpenNext，避免与纯 Node 托管冲突。
// Cloudflare Workers（OpenNext）构建未设置 VERCEL，需要初始化以匹配适配器预期。
if (process.env.VERCEL !== "1") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
