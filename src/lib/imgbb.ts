/**
 * imgbb API v1 约定（见 https://api.imgbb.com/ ）：
 * - `image`：base64 或文件；官方文档写明单图最大约 32MB。
 * - `expiration`（可选）：秒，范围 60–15552000；设置后图片会在到期后由 imgbb 自动删除。
 *
 * 本应用对上传接口额外限制为 16MB，并在调用 imgbb 时使用 30 天过期。
 */
export const IMGBB_UPLOAD_MAX_BYTES = 16 * 1024 * 1024; // 16 MiB（本 API 限制）

/** imgbb `expiration`：30 天（秒），须在官方允许区间 [60, 15552000] 内 */
export const IMGBB_DEFAULT_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 2_592_000

const IMGBB_EXPIRATION_MIN = 60;
const IMGBB_EXPIRATION_MAX = 15_552_000;

export function resolveImgbbExpirationSeconds(): number {
  const raw = process.env.IMGBB_EXPIRATION_SECONDS;
  if (raw === undefined || raw === "") return IMGBB_DEFAULT_EXPIRATION_SECONDS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return IMGBB_DEFAULT_EXPIRATION_SECONDS;
  return Math.min(IMGBB_EXPIRATION_MAX, Math.max(IMGBB_EXPIRATION_MIN, n));
}

export function assertUploadSizeWithinLimit(sizeBytes: number) {
  if (sizeBytes > IMGBB_UPLOAD_MAX_BYTES) {
    throw new Error(`文件过大：最大 ${IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024)}MB`);
  }
}
