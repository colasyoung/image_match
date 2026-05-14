# Image Match

匿名图片 1v1 对战与**实时人气**（Next.js + Supabase + imgbb）。详见仓库内 `supabase/migrations/` 与 `src/server/match-service.ts`。

## 本地测试（推荐先做）

### 1. Supabase

1. 在 [Supabase](https://supabase.com) 新建项目，等待数据库就绪。
2. 打开 **SQL Editor**，把仓库里 `supabase/migrations/20260514000000_init.sql` **全文粘贴执行**。若某行报错（例如 `publication` 里已包含该表），删掉对应 `alter publication` 行后重试。
3. **Project Settings → API**：复制 `Project URL`、`anon public` key、`service_role` key（**不要**提交到 Git，只放本地 `.env.local` 或 Vercel 环境变量）。
4. **Database → Publications**：确认 `supabase_realtime` 里勾选了 `matches`、`images`（否则前端实时榜不会更新）。

### 2. imgbb

在 [imgbb API](https://api.imgbb.com/) 申请 key，写入 `IMGBB_API_KEY`。

**上传接口** `POST /api/upload-image`（`multipart/form-data`，字段 `matchId`、`manageToken`、`file`）：

- 服务端代理调用 imgbb，**不在前端暴露 key**。
- **单文件最大 16MB**（本应用限制；imgbb 文档中单图上限更高，此处按 16MB 截断）。
- 调用 imgbb 时携带 **`expiration`**（秒，默认 **2592000 = 30 天**），到期后由 **imgbb 自动删除** 托管文件；数据库里仍会存 URL，过期后链接可能失效，重要素材请自行备份或改用自有存储。
- 可选环境变量 **`IMGBB_EXPIRATION_SECONDS`**：覆盖过期秒数，须在 imgbb 允许范围 **60–15552000**（见官方文档）。

**接口说明（机器可读）**：浏览器或脚本访问 **`GET /api/upload-image`** 可拿到字段说明、大小限制、`expiration` 说明与官方文档链接。

### 3. 环境变量与启动

```bash
cd /path/to/image_match
cp .env.example .env.local
# 编辑 .env.local，填齐 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、
# SUPABASE_SERVICE_ROLE_KEY、IMGBB_API_KEY（可选 IMGBB_EXPIRATION_SECONDS）

npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)，走「创建 → 上传至少 2 张图 → 开启比赛 → 进入 `/m/你的slug`」完整试一遍。

创建页在**开启比赛成功后不会自动跳转**投票页，会先展示「比赛已开启」并再次强调复制管理链接，避免来不及保存管理入口。

### 管理页面在哪？

- **单个比赛**（创建后 API 也会返回）：`https://你的域名/manage/<slug>?token=<manage_token>`  
  例如：`https://xxx.vercel.app/manage/abc12xyz34?token=一长串十六进制`  
  创建成功页会高亮显示并可一键复制；**请勿把带 token 的链接发给普通投票用户**（只给主办方）。

- **可选「总站」**（方便你一个人管所有比赛）：在 `.env.local` / Vercel 中设置 **`MASTER_ADMIN_SECRET`** 为足够长的随机串，然后访问：  
  `https://你的域名/admin?key=<与 MASTER_ADMIN_SECRET 完全相同的值>`  
  会列出数据库中的比赛及各自完整管理链接。`key` 与密钥不一致或未配置时，页面会显示 404（避免暴露后台存在）。**切勿把该 URL 发到公网或聊天记录。**

---

## 部署到公网（推荐 Vercel）

本应用含 **API Routes**，需要支持 **Node.js** 的托管，**不要**用 GitHub Pages。

1. 登录 [Vercel](https://vercel.com)，**Add New → Project**，导入你的 GitHub 仓库。
2. Framework Preset 选 **Next.js**，其余默认即可。
3. **Environment Variables** 里添加与 `.env.example` 一致的项目（值与 Supabase / imgbb 控制台一致）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（仅服务端使用，不要改成 `NEXT_PUBLIC_`）
   - `IMGBB_API_KEY`
   - （可选）`IMGBB_EXPIRATION_SECONDS`：imgbb 自动删除延迟（秒，60–15552000；默认 2592000 = 30 天）
   - （可选）`MASTER_ADMIN_SECRET`：用于 `/admin?key=…` 总站，见上文「管理页面」
4. 点击 **Deploy**。完成后用 Vercel 提供的 `*.vercel.app` 域名测试；若上传图片失败，在 **imgbb** 或 **Vercel 函数日志**里看报错（常见为 key 错误或 imgbb 域名未在 `next.config.ts` 的 `images.remotePatterns` 中，可按实际图片域名增补）。

#### Vercel 部署失败 / GitHub 上 Vercel check 红字

1. 打开 Vercel 项目 → **Deployments → 失败的那条 → Build Logs**，看最后一屏报错（依赖下载、Node 版本、或 **Build / Deploy** 哪一步失败）。
2. 本项目在 `package.json` 里声明了 **`engines.node >= 20.9.0`**；请在 Vercel **Settings → General → Node.js Version** 选 **20.x**（不要低于 20.9）。
3. 仓库内已带 **`.npmrc`**（固定 `registry.npmjs.org`）与 **`package-lock.json`**，避免国内镜像在海外构建机上下载失败或超时。
4. 确认 **Environment Variables** 已按上文填齐（缺变量时运行期会报错；一般不影响 `next build`）。
5. 根目录 **`vercel.json`** 仅设置 `buildCommand`；安装使用 Vercel 默认 **`npm install`**（与 lockfile 一致即可）。若 Build 绿但 Deploy 红，在日志中搜 `Error` / `limit`。

#### Cloudflare Workers 自动构建（OpenNext）

若你在 Cloudflare 上为仓库配置了 **Git 自动构建**，默认构建命令常为 **`npx opennextjs-cloudflare build`**。本仓库已包含 **`@opennextjs/cloudflare` + `wrangler.jsonc` + `open-next.config.ts`**，与上述命令兼容。

- **环境变量**：在 Cloudflare 项目的 **Settings → Variables** 中为 Worker 配置与 `.env.example` / Vercel 相同的变量（如 `NEXT_PUBLIC_SUPABASE_*`、`SUPABASE_SERVICE_ROLE_KEY`、`IMGBB_API_KEY` 等），否则运行期接口会失败。
- **`wrangler.jsonc` 里的 `name` / `services[0].service`** 需与你在 Cloudflare 控制台里的 **Worker 名称**一致（当前为 `image-match`；若你的服务名不同，请改两处保持一致）。

**构建成功但浏览器「访问不到」或白屏时**，请逐项核对：

1. **访问的 URL 是否正确**  
   Workers 默认域名一般为：  
   `https://<worker 名称>.<你的子域>.workers.dev`  
   （在 **Workers & Pages → image-match → 概览** 里可复制；**不是** GitHub 仓库地址，也通常**不是** Cloudflare Pages 的 `*.pages.dev`。）
2. **先探活**：浏览器或终端访问 **`/api/health`**，例如 `https://…workers.dev/api/health`  
   应返回 JSON：`{"ok":true,"service":"image-match"}`。若此处 404/522，说明流量没到 Worker 或路由未生效。
3. **环境变量是否在 Worker 上配置**  
   与 `.env.example` 一致：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`IMGBB_API_KEY` 等。缺省时首页/API 会报错或空白。敏感项用 **Encrypt**。
4. **自定义域名**  
   若绑了自有域名，需在 DNS 按 Cloudflare 提示指向该 Worker，并等待生效；未生效前请先用 `*.workers.dev` 验证。
5. **本地看实时日志**（可选）：安装依赖后执行 `npx wrangler tail`（需登录 Cloudflare），再刷新页面看服务端报错。

**仍更简单、推荐的做法**：应用主部署在 **Vercel**（`npm run build`），Cloudflare **只做 DNS** 指到 Vercel（见下）。两套 CI（Vercel + Cloudflare）同时连同一分支时，维护成本更高。

若不再需要 Cloudflare 自动构建：可到 **Workers & Pages → 项目 → Settings → Builds → Disconnect** 断开 Git。

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

- **推荐（与规格一致）**：把本仓库接到 **[Vercel](https://vercel.com)**（或 Netlify / 其他支持 Node 的托管），在控制台配置与 `.env.example` 相同的环境变量，即可得到公网 HTTPS 地址给用户测试。若同时使用 **Cloudflare Workers 自动构建**，需按上文「Cloudflare Workers 自动构建（OpenNext）」配齐 OpenNext 与 Worker 环境变量；否则更推荐 **Cloudflare 只做 DNS / CDN 前置** 指向 Vercel。
- **若必须使用 `*.github.io`**：需要把业务全部改成「纯静态前端 + Supabase Edge Functions / 仅客户端 + RLS」等大改，**当前仓库未按该模式实现**。

本仓库已包含 **GitHub Actions CI**（`.github/workflows/ci.yml`），在每次 push / PR 时执行 `npm run build` 做基础校验。
