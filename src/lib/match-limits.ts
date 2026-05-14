/** 普通用户每场比赛最大图片数（管理员密钥可绕过） */
export const DEFAULT_MAX_IMAGES_PER_MATCH = 10;

const ADMIN_UI_CAP = 100_000;

/** 有管理员密钥输入时视为无上限（仅 UI；服务端仍校验密钥） */
export function effectiveImageCap(adminBypassToken: string): number {
  return adminBypassToken.trim().length > 0 ? ADMIN_UI_CAP : DEFAULT_MAX_IMAGES_PER_MATCH;
}
