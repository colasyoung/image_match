# Image Match

匿名图片 1v1 对战与**实时人气**（Next.js + Supabase + imgbb）。详见仓库内 `supabase/migrations/` 与 `src/server/match-service.ts`。

## 本地测试（推荐先做）

### 1. Supabase

1. 在 [Supabase](https://supabase.com) 新建项目，等待数据库就绪。
2. 打开 **SQL Editor**，把仓库里 `supabase/migrations/20260514000000_init.sql` **全文粘贴执行**。若某行报错（例如 `publication` 里已包含该表），删掉对应 `alter publication` 行后重试。
3. **Project Settings → API**：复制 `Project URL`、`anon public` key、`service_role` key（**不要**提交到 Git，只放在本地或服务端环境变量中）。
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

- **可选「总站」**（方便集中管理多场比赛）：在环境变量中设置 **`MASTER_ADMIN_SECRET`** 为足够长的随机串，然后访问：  
  `https://你的域名/admin?key=<与 MASTER_ADMIN_SECRET 完全相同的值>`  
  会列出数据库中的比赛及各自完整管理链接。`key` 与密钥不一致或未配置时，页面会显示 404（避免暴露后台存在）。**切勿把该 URL 发到公网或聊天记录。**

---

## 公网运行

本应用含 **API Routes**，需要支持 **Node.js** 的 Next.js 运行时（常见 PaaS 均可）。在托管控制台配置与 `.env.example` **同名同含义**的环境变量即可。

仓库内附带 **OpenNext + Cloudflare** 相关文件；若你在该路线或类似边缘平台上构建，请按对应官方文档设置构建命令与变量。构建或运行报错时，以该平台日志与 `npm run build` 本地输出为准。

## 推到 GitHub

在 GitHub 新建空仓库（不要勾选添加 README），然后在项目根目录执行（将 `YOUR_USER` 与仓库名换成你的）：

```bash
git remote add origin https://github.com/YOUR_USER/image_match.git
git branch -M main
git push -u origin main
```

若使用 SSH：`git remote add origin git@github.com:YOUR_USER/image_match.git`

## 关于 GitHub Pages

**GitHub Pages 只托管静态站点**，无法运行本仓库的 **Next.js 服务端与 `/api/*`**。若需要公网地址，请使用支持 Node 的托管，并配置与 `.env.example` 一致的环境变量。

本仓库含 **GitHub Actions CI**（`.github/workflows/ci.yml`），在 push / PR 时执行 `npm run build` 做基础校验。
