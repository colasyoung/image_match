/** Map API `error` string → `t('api.*')` path */
const API_ERROR_PATH: Record<string, string> = {
  Unauthorized: "api.Unauthorized",
  "Not found": "api.NotFound",
  Bad: "api.Bad",
  "Need at least 2 images": "api.NeedAtLeast2",
  "Cannot activate from current state": "api.CannotActivate",
  "Max 10 images": "api.Max10",
  "Rate limited": "api.RateLimited",
};

export function friendlyApiError(raw: string, t: (path: string) => string): string {
  const path = API_ERROR_PATH[raw];
  if (path) return t(path);
  if (raw === "创建失败" || raw === "Create failed") return t("api.CreateFail");
  if (raw === "上传失败" || raw === "Upload failed") return t("api.UploadFail");
  return raw;
}
