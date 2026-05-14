import { NextResponse } from "next/server";
import { DEFAULT_MAX_IMAGES_PER_MATCH } from "@/lib/match-limits";
import { NsfwContentRejectedError } from "@/lib/nsfw-screen";
import { createMatchMultipartPayloadSchema } from "@/lib/schemas";
import { clientIpFromHeaders, regionFromHeaders } from "@/lib/ip";
import { createMatchWithInitialMedia, type InitialMediaEntry } from "@/server/match-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "请使用 multipart/form-data 提交：payload（JSON）与图片文件。" },
        { status: 415 }
      );
    }

    const form = await req.formData();
    const payloadRaw = String(form.get("payload") ?? "");
    const adminBypassRaw = String(form.get("adminUploadBypassToken") ?? "").trim();
    const bypassSecret = process.env.ADMIN_IMAGE_UPLOAD_BYPASS_SECRET?.trim();
    const bypassOk = Boolean(bypassSecret && adminBypassRaw && adminBypassRaw === bypassSecret);

    if (adminBypassRaw && !bypassSecret) {
      return NextResponse.json({ error: "服务器未配置管理员免上限密钥，无法使用该字段" }, { status: 400 });
    }
    if (adminBypassRaw && bypassSecret && !bypassOk) {
      return NextResponse.json({ error: "管理员免上限密钥不正确" }, { status: 403 });
    }

    let parsed: ReturnType<typeof createMatchMultipartPayloadSchema.parse>;
    try {
      parsed = createMatchMultipartPayloadSchema.parse(JSON.parse(payloadRaw));
    } catch {
      return NextResponse.json({ error: "payload 无效或不是合法 JSON" }, { status: 400 });
    }

    const maxQueue = bypassOk ? 500 : DEFAULT_MAX_IMAGES_PER_MATCH;
    if (parsed.queue.length > maxQueue) {
      return NextResponse.json({ error: "图片数量超过本场允许上限" }, { status: 400 });
    }

    const seenFileSlots = new Set<number>();
    const entries: InitialMediaEntry[] = [];

    for (const item of parsed.queue) {
      if (item.type === "file") {
        if (seenFileSlots.has(item.slot)) {
          return NextResponse.json({ error: "重复的文件序号" }, { status: 400 });
        }
        seenFileSlots.add(item.slot);
        const blob = form.get(`f_${item.slot}`);
        if (!(blob instanceof Blob) || blob.size === 0) {
          return NextResponse.json({ error: `缺少或空的文件字段 f_${item.slot}` }, { status: 400 });
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        const name = blob instanceof File && blob.name ? blob.name : "upload";
        entries.push({ kind: "file", buffer: buf, filename: name });
      } else {
        entries.push({ kind: "url", url: item.url });
      }
    }

    const headers = req.headers;
    const result = await createMatchWithInitialMedia(
      {
        title: parsed.title.trim(),
        description: parsed.description?.trim() || undefined,
        isPublic: parsed.isPublic,
        clientIp: clientIpFromHeaders(headers),
        region: regionFromHeaders(headers),
      },
      entries,
      { bypassImageLimit: bypassOk }
    );

    return NextResponse.json({
      slug: result.slug,
      manageToken: result.manageToken,
      id: result.id,
      images: result.images,
      publicUrl: `/m/${result.slug}`,
      manageUrl: `/manage/${result.slug}?token=${result.manageToken}`,
    });
  } catch (e) {
    if (e instanceof NsfwContentRejectedError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
