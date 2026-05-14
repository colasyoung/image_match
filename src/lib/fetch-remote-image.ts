import { IMGBB_UPLOAD_MAX_BYTES } from "@/lib/imgbb";

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (
    h === "localhost" ||
    h === "metadata.google.internal" ||
    h === "metadata" ||
    h === "ipv6only.arpa" ||
    h.endsWith(".local")
  ) {
    return true;
  }
  if (h === "127.0.0.1" || h === "0.0.0.0" || h === "::1" || h === "169.254.169.254") return true;

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    const d = Number(m[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

async function readBodyWithCap(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Buffer> {
  if (!body) throw new Error("远程无响应体");
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`文件过大：最大 ${maxBytes / (1024 * 1024)}MB`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function sniffIsImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return true;
  return false;
}

function filenameFromUrl(u: URL): string {
  try {
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (seg) {
      const base = decodeURIComponent(seg);
      if (/\.(jpe?g|png|gif|webp|avif)$/i.test(base)) return base.slice(0, 120);
    }
  } catch {
    /* ignore */
  }
  return "remote.jpg";
}

/**
 * 服务端拉取公网图片（用于从网页拖拽 URL / 外链导入），带基础 SSRF 与体积限制。
 */
export async function downloadImageForUpload(urlStr: string): Promise<{ buffer: Buffer; filename: string }> {
  let u: URL;
  try {
    u = new URL(urlStr.trim());
  } catch {
    throw new Error("无效的图片地址");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("仅支持 http(s) 图片地址");
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error("该地址不允许拉取");
  }

  const res = await fetch(u.toString(), {
    redirect: "follow",
    headers: { "User-Agent": "image-match/1.0 (image-import)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`拉取图片失败（HTTP ${res.status}）`);
  }

  const cl = res.headers.get("content-length");
  if (cl) {
    const n = Number.parseInt(cl, 10);
    if (Number.isFinite(n) && n > IMGBB_UPLOAD_MAX_BYTES) {
      throw new Error(`文件过大：最大 ${IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024)}MB`);
    }
  }

  const rawCt = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const buf = await readBodyWithCap(res.body, IMGBB_UPLOAD_MAX_BYTES + 1);
  if (buf.byteLength > IMGBB_UPLOAD_MAX_BYTES) {
    throw new Error(`文件过大：最大 ${IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024)}MB`);
  }

  if (!rawCt.startsWith("image/")) {
    if (rawCt !== "application/octet-stream" && rawCt !== "binary/octet-stream") {
      throw new Error("远程内容不是图片（Content-Type 不允许）");
    }
    if (!sniffIsImage(buf)) {
      throw new Error("远程内容不是可识别的图片格式");
    }
  }

  return { buffer: buf, filename: filenameFromUrl(u) };
}
