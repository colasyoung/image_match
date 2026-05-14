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

**上传接口** `POST /api/upload-image`（`multipart/form-data`；字段含 `matchId`、`manageToken`、`file` 或 `imageUrl`，可选 `adminUploadBypassToken`）：

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
# SUPABASE_SERVICE_ROLE_KEY、IMGBB_API_KEY（可选 IMGBB_EXPIRATION_SECONDS、MASTER_ADMIN_SECRET、
# ADMIN_IMAGE_UPLOAD_BYPASS_SECRET，后两者说明见 .env.example 注释）

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

### 管理员：突破「每场比赛最多 10 张图」（可选）

默认每场比赛最多 **10** 张图。若要在单场里继续传更多张，需要同时满足：

1. **服务端**已在环境变量里配置 **`ADMIN_IMAGE_UPLOAD_BYPASS_SECRET`**（本地写在 `.env.local`，线上写在 Vercel 等托管的 Environment Variables 里，**改完需重新部署**）。未配置则永远无法突破 10 张。
2. **浏览器侧**把**与上述环境变量完全相同**的字符串交给上传接口。产品界面**不**提供该入口；仅建议在受控环境通过 **URL 查询参数**附带（打开一次后写入本机 `sessionStorage`，之后同域上传会自动带上），例如：  
     `https://你的域名/manage/<slug>?token=<manage_token>&uploadBypass=<密钥>`  
     `https://你的域名/create?uploadBypass=<密钥>`  

上传时 POST 表单会带字段 **`adminUploadBypassToken`**；仅当它与 **`ADMIN_IMAGE_UPLOAD_BYPASS_SECRET`** 一致时，服务端才取消 10 张限制。参数名 `uploadBypass` 与代码常量的对应关系见 `src/lib/admin-upload-bypass.ts`。**勿**把带 `uploadBypass=` 的链接发到公网或聊天记录（会泄露密钥）。

---

## 公网运行

本应用含 **API Routes**，需要支持 **Node.js** 的 Next.js 运行时（常见 PaaS 均可）。`package.json` 的 **`engines.node`** 为 **`22.x`**（锁定 **Node 22** 主版本线，满足 **wrangler** 4.9x 的 `>=22`，并减少 Vercel 对「`>=` 跨大版本」的提示）。**推荐本地与 CI 使用 Node 22**（与 Vercel 默认一致）；若本机为 Node 24，npm 可能对根包提示 `EBADENGINE`，默认仍会继续安装。在托管控制台配置与 `.env.example` **同名同含义**的环境变量即可。

仓库内附带 **OpenNext + Cloudflare** 相关文件；若你在该路线或类似边缘平台上构建，请按对应官方文档设置构建命令与变量。构建或运行报错时，以该平台日志与 `npm run build` 本地输出为准。

## 地区标签、隐私与内容责任（部署方必读）

本应用**不**声称在任意法域均已满足全部监管要求；面向公众上线前请自行完成合规审查（必要时咨询法律顾问）。

- **地区字符串**：来自托管平台（如 Vercel / Cloudflare）根据 IP 推断的请求头，**仅为粗略、聚合的 UI 统计**，可能错误或不更新；**不代表**用户的国籍、户籍或官方行政区划认定。展示层对若干敏感标签采用常见技术性写法（例如 ISO 3166-2:CN 子码对应中文行政区名、IOC 对 `TW` 的中英文用名、`HK`/`MO` 的常见中英文表述），以降低 UI 层面的歧义；**不构成**任何政治或领土主张。
- **IP 与投票**：投票记录中存的是 **IP 的单向哈希**（`battles.voter_ip_hash`），不存明文投票者 IP；创建比赛时存创建者 IP 的哈希（`matches.creator_ip_hash`）及当时的地区字符串（`created_ip_region`）。地区串仍属可能重识别的辅助信息，若你面向 GDPR 等严格场景，请自行评估法律依据、保留期限与隐私政策披露。
- **语言 Cookie**：用户切换界面语言时写入本站第一方 Cookie（`image_match_locale`）；在 **HTTPS** 下会附加 **`Secure`**。若你面向欧盟等法域，请自行判断是否需要 Cookie 横幅或同意流程。
- **用户生成内容**：图片由比赛举办方通过本应用上传至 imgbb（或你改动的存储）；**举办方**对著作权、非法或有害内容等承担首要责任；请在上游配置滥用举报与删除流程。
- **成人内容（自动化粗检）**：服务端在上传至图床前使用 **nsfwjs（TensorFlow Node）** 对图片做色情/成人漫画类等粗检，明显命中则拒绝写入图床（HTTP 422，`error` 为 `NSFW_REJECTED`）。**不能**替代人工审核或当地法律下的合规义务；误判或无法加载模型时可能放行并打日志。无原生 TF 的运行时可设 **`DISABLE_NSFW_SCREENING=1`** 关闭（见 `.env.example`）。

实现入口：`src/lib/region-display.ts`、`src/lib/ip.ts`、`src/lib/cn-region-iso.ts`、`src/server/match-service.ts`；页脚有面向终端用户的简要说明（`site.complianceFoot`）。

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
