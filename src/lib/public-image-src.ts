/**
 * 浏览器侧图片 src：可选把 imgbb 域名改写到自建 CDN / 反代（便于中国大陆就近拉取）。
 * 部署时设置 `NEXT_PUBLIC_IMGBB_CDN_MIRROR`（无尾斜杠），例如 `https://img.example.com`；
 * 则 `https://i.ibb.co/foo/bar.png` → `https://img.example.com/foo/bar.png`（路径与 query 保留）。
 */
export function publicImageSrc(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u) return "";

  const mirror = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_IMGBB_CDN_MIRROR?.trim() : "";
  if (!mirror) return u;

  try {
    const parsed = new URL(u);
    const h = parsed.hostname.toLowerCase();
    const isImgbb = h === "i.ibb.co" || h === "image.ibb.co" || h.endsWith(".ibb.co");
    if (!isImgbb) return u;
    const base = mirror.replace(/\/$/, "");
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    return u;
  }
}

/** 对战缩略图层：仅 `thumb_url`（无则空串，表示不做「先糊后清」）。 */
export function duelThumbOnlySrc(image: { thumb_url: string | null }): string {
  return publicImageSrc((image.thumb_url ?? "").trim());
}

/** 对战高清层：主图 URL。 */
export function duelFullSrc(image: { image_url: string }): string {
  return publicImageSrc((image.image_url ?? "").trim());
}

/** 对战卡片等：优先缩略图，减少跨境传输字节；再套一层 `publicImageSrc` 以支持镜像。 */
export function voteCardImageSrc(image: { image_url: string; thumb_url: string | null }): string {
  return publicImageSrc((image.thumb_url || image.image_url || "").trim());
}
