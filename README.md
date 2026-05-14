# Image Match

匿名图片 1v1 对战与 **Elo** 实时排行榜（Next.js + Supabase + imgbb）。详见仓库内 `supabase/migrations/` 与 `src/server/match-service.ts`。

## 本地测试（推荐先做）

### 1. Supabase

1. 在 [Supabase](https://supabase.com) 新建项目，等待数据库就绪。
2. 打开 **SQL Editor**，把仓库里 `supabase/migrations/20260514000000_init.sql` **全文粘贴执行**。若某行报错（例如 `publication` 里已包含该表），删掉对应 `alter publication` 行后重试。
3. **Project Settings → API**：复制 `Project URL`、`anon public` key、`service_role` key（**不要**提交到 Git，只放本地 `.env.local` 或 Vercel 环境变量）。
4. **Database → Publications**：确认 `supabase_realtime` 里勾选了 `matches`、`images`（否则前端实时榜不会更新）。

### 2. imgbb

在 [imgbb API](https://api.imgbb.com/) 申请 key，写入下面 `IMGBB_API_KEY`。

### 3. 环境变量与启动

```bash
cd /path/to/image_match
cp .env.example .env.local
# 编辑 .env.local，填齐 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、
# SUPABASE_SERVICE_ROLE_KEY、IMGBB_API_KEY

npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)，走「创建 → 上传至少 2 张图 → 开启比赛 → 进入 `/m/你的slug`」完整试一遍。

---

## 部署到公网（推荐 Vercel）

本应用含 **API Routes**，需要支持 **Node.js** 的托管，**不要**用 GitHub Pages。

1. 登录 [Vercel](https://vercel.com)，**Add New → Project**，导入你的 GitHub 仓库。
2. Framework Preset 选 **Next.js**，其余默认即可。
3. **Environment Variables** 里添加与 `.env.example` 相同的四项（值与 Supabase / imgbb 控制台一致）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（仅服务端使用，不要改成 `NEXT_PUBLIC_`）
   - `IMGBB_API_KEY`
4. 点击 **Deploy**。完成后用 Vercel 提供的 `*.vercel.app` 域名测试；若上传图片失败，在 **imgbb** 或 **Vercel 函数日志**里看报错（常见为 key 错误或 imgbb 域名未在 `next.config.ts` 的 `images.remotePatterns` 中，可按实际图片域名增补）。

每次 push 到默认分支，Vercel 会自动重新部署（可在项目设置里改分支）。

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
