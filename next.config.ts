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

// 本地开发与 Cloudflare / OpenNext 对齐；生产 `next build`（如 Vercel）可安全加载该模块
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
