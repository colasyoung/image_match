import { NextResponse } from "next/server";
import { downloadImageForUpload } from "@/lib/fetch-remote-image";
import { addImageToMatch, uploadImageToImgbb } from "@/server/match-service";
import {
  IMGBB_DEFAULT_EXPIRATION_SECONDS,
  IMGBB_UPLOAD_MAX_BYTES,
  resolveImgbbExpirationSeconds,
} from "@/lib/imgbb";

/**
 * POST multipart：字段 `matchId`、`manageToken`、`file`（单文件）。
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
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const matchId = String(form.get("matchId") ?? "");
    const manageToken = String(form.get("manageToken") ?? "");
    const imageUrlField = String(form.get("imageUrl") ?? "").trim();
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
    const row = await addImageToMatch({
      matchId,
      manageToken,
      imageUrl: uploaded.url,
      thumbUrl: uploaded.thumb,
      width: uploaded.width,
      height: uploaded.height,
    });
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
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
