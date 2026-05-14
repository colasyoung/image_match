import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/** OpenNext on Cloudflare — 无 R2 时的最小配置（缓存能力弱于生产推荐方案） */
export default defineCloudflareConfig({});
