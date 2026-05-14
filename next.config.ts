import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** nsfwjs / TensorFlow Node 含原生绑定，勿打进 serverless bundle */
  serverExternalPackages: ["@tensorflow/tfjs-node", "@tensorflow/tfjs", "nsfwjs"],
  images: {
    /** imgbb 及常见子域；由 Next 边缘按需缩放 WebP/AVIF，减轻大图直链耗时 */
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co", pathname: "/**" },
      { protocol: "https", hostname: "image.ibb.co", pathname: "/**" },
      { protocol: "https", hostname: "*.ibb.co", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
};

export default nextConfig;

// Vercel 构建与运行时会设置 VERCEL=1；此处跳过 OpenNext，避免与纯 Node 托管冲突。
// Cloudflare Workers（OpenNext）构建未设置 VERCEL，需要初始化以匹配适配器预期。
if (process.env.VERCEL !== "1") {
  void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
