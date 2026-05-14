# Image Match

匿名图片 1v1 对战与 **Elo** 实时排行榜（Next.js + Supabase + imgbb）。详见仓库内 `supabase/migrations/` 与 `src/server/match-service.ts`。

## 本地运行

```bash
cp .env.example .env.local
# 填入 Supabase 与 IMGBB 密钥后：
npm install
npm run dev
```

## 推到 GitHub

在 GitHub 新建空仓库（不要勾选添加 README），然后在项目根目录执行（将 `YOUR_USER` 与仓库名换成你的）：

```bash
git remote add origin https://github.com/YOUR_USER/image_match.git
git branch -M main
git push -u origin main
```

若使用 SSH：`git remote add origin git@github.com:YOUR_USER/image_match.git`

## 关于「GitHub Pages」与公网测试

**GitHub Pages 只托管静态文件**（HTML/CSS/前端 JS），**不能运行**本项目的 **Next.js 服务端与 `/api/*` 路由**（创建比赛、投票、imgbb 代理、限流等均依赖 Node 运行时）。

因此：

- **推荐（与规格一致）**：把本仓库接到 **[Vercel](https://vercel.com)**（或 Netlify / Cloudflare Workers 等支持 Node 的平台），在控制台配置与 `.env.example` 相同的环境变量，即可得到公网 HTTPS 地址给用户测试。
- **若必须使用 `*.github.io`**：需要把业务全部改成「纯静态前端 + Supabase Edge Functions / 仅客户端 + RLS」等大改，**当前仓库未按该模式实现**。

本仓库已包含 **GitHub Actions CI**（`.github/workflows/ci.yml`），在每次 push / PR 时执行 `npm run build` 做基础校验。
