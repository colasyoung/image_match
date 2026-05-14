import { NextResponse } from "next/server";
import { downloadImageForUpload } from "@/lib/fetch-remote-image";
import { NsfwContentRejectedError } from "@/lib/nsfw-screen";
import { addImageToMatch, uploadImageToImgbb } from "@/server/match-service";
import {
  IMGBB_DEFAULT_EXPIRATION_SECONDS,
  IMGBB_UPLOAD_MAX_BYTES,
  resolveImgbbExpirationSeconds,
} from "@/lib/imgbb";

export const runtime = "nodejs";

/**
 * POST multipart：字段 `matchId`、`manageToken`、`file` 或 `imageUrl`；可选 `adminUploadBypassToken`（与 ADMIN_IMAGE_UPLOAD_BYPASS_SECRET 一致时忽略 10 张上限）。
 * GET：返回本接口约束与 imgbb 行为说明（供前端 / 第三方对接）。
 *
 * imgbb 文档：https://api.imgbb.com/
 */
export async function GET() {
  const expiration = resolveImgbbExpirationSeconds();
  return NextResponse.json({
    endpoint: "/api/upload-image",
    methods: ["POST"],
    post: {
      contentType: "multipart/form-data",
      fields: {
        matchId: "比赛 UUID（与创建接口返回的 id 一致）",
        manageToken: "该比赛的管理 token",
        file: "单个图片文件（与 imageUrl 二选一）",
        imageUrl: "可选：公网 http(s) 图片地址，由服务端拉取后再传 imgbb（与 file 二选一）",
        adminUploadBypassToken:
          "可选：与部署环境 ADMIN_IMAGE_UPLOAD_BYPASS_SECRET 完全一致时，忽略每场比赛 10 张上限。浏览器侧来源：创建页/管理页折叠输入框，或 URL 查询参数 uploadBypass（见 README 与 .env.example）。仅服务端校验；勿泄露。",
      },
      adminUploadBypass: {
        serverEnvVar: "ADMIN_IMAGE_UPLOAD_BYPASS_SECRET",
        serverWhere:
          "必须写在运行 Next 的环境（本地 .env.local 或 Vercel 等托管的 Environment Variables），部署后需重新发布；未配置则永远不能突破 10 张/场。",
        clientHow:
          "POST 表单字段 adminUploadBypassToken，值须与 ADMIN_IMAGE_UPLOAD_BYPASS_SECRET 完全相同；或由前端从 URL ?uploadBypass= 同步到该字段后随上传提交。",
        urlQueryParam: "uploadBypass",
        urlQueryParamDefinedIn: "src/lib/admin-upload-bypass.ts",
      },
    },
    limits: {
      maxFileBytes: IMGBB_UPLOAD_MAX_BYTES,
      maxFileSizeHuman: "16MB",
      note: "本服务在接收前校验大小；imgbb 官方单图上限更高（文档约 32MB），此处按产品限制为 16MB。",
    },
    imgbb: {
      documentationUrl: "https://api.imgbb.com/",
      expirationSeconds: expiration,
      expirationDefaultSeconds: IMGBB_DEFAULT_EXPIRATION_SECONDS,
      autoDelete:
        "已设置 imgbb 参数 `expiration`（秒）。到期后由 imgbb 自动删除托管文件；数据库中仍会保留 URL，届时链接可能失效，需重新上传或迁移存储。",
      expirationEnvOverride:
        "可选环境变量 IMGBB_EXPIRATION_SECONDS（整数秒，须在 imgbb 允许范围 60–15552000 内；默认 2592000 = 30 天）。",
    },
    nsfwScreening: {
      enabledByDefault: true,
      disableEnv: "DISABLE_NSFW_SCREENING=1",
      note: "服务端在上传至 imgbb 前用 nsfwjs（TensorFlow Node）做自动化粗检；误判/无 TF 环境可关闭。命中时 HTTP 422，error 为 NSFW_REJECTED。",
    },
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const matchId = String(form.get("matchId") ?? "");
    const manageToken = String(form.get("manageToken") ?? "");
    const imageUrlField = String(form.get("imageUrl") ?? "").trim();
    const adminBypassRaw = String(form.get("adminUploadBypassToken") ?? "").trim();
    const bypassSecret = process.env.ADMIN_IMAGE_UPLOAD_BYPASS_SECRET?.trim();
    const bypassOk = Boolean(bypassSecret && adminBypassRaw && adminBypassRaw === bypassSecret);

    if (adminBypassRaw && !bypassSecret) {
      return NextResponse.json({ error: "服务器未配置管理员免上限密钥，无法使用该字段" }, { status: 400 });
    }
    if (adminBypassRaw && bypassSecret && !bypassOk) {
      return NextResponse.json({ error: "管理员免上限密钥不正确" }, { status: 403 });
    }

    const file = form.get("file");
    if (!matchId || !manageToken) {
      return NextResponse.json({ error: "matchId, manageToken required" }, { status: 400 });
    }

    let buf: Buffer;
    let name: string;

    if (imageUrlField) {
      if (file instanceof Blob && file.size > 0) {
        return NextResponse.json({ error: "请只传 file 或 imageUrl 之一" }, { status: 400 });
      }
      const remote = await downloadImageForUpload(imageUrlField);
      buf = remote.buffer;
      name = remote.filename;
    } else if (file instanceof Blob) {
      const blob = file as Blob;
      if (blob.size > IMGBB_UPLOAD_MAX_BYTES) {
        return NextResponse.json(
          { error: `文件过大：最大 ${IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024)}MB` },
          { status: 413 }
        );
      }
      buf = Buffer.from(await blob.arrayBuffer());
      if (buf.byteLength > IMGBB_UPLOAD_MAX_BYTES) {
        return NextResponse.json(
          { error: `文件过大：最大 ${IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024)}MB` },
          { status: 413 }
        );
      }
      name = (file as File).name || "upload";
    } else {
      return NextResponse.json({ error: "需要 file 或 imageUrl" }, { status: 400 });
    }

    const uploaded = await uploadImageToImgbb(buf.toString("base64"), name);
    const row = await addImageToMatch(
      {
        matchId,
        manageToken,
        imageUrl: uploaded.url,
        thumbUrl: uploaded.thumb,
        width: uploaded.width,
        height: uploaded.height,
      },
      { bypassImageLimit: bypassOk }
    );
    return NextResponse.json({
      image: row,
      storage: {
        provider: "imgbb",
        expirationSeconds: uploaded.imgbbExpirationSeconds,
        note:
          "图片在 imgbb 侧设置了 expiration，约在该秒数后自动删除；请及时备份重要素材或迁移到自有存储。",
      },
    });
  } catch (e) {
    if (e instanceof NsfwContentRejectedError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
