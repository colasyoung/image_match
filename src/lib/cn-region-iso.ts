import type { AppLocale } from "@/lib/i18n/types";

/**
 * ISO 3166-2:CN 一级行政区代码（不含 CN- 前缀）→ 中文常用称谓。
 * 供 `x-vercel-ip-country-region` / `cf-region-code` 等解析使用。
 * @see https://www.iso.org/obp/ui/#iso:code:3166:CN
 */
const CN_SUBDIVISION_ZH: Record<string, string> = {
  AH: "安徽省",
  BJ: "北京市",
  CQ: "重庆市",
  FJ: "福建省",
  GD: "广东省",
  GS: "甘肃省",
  GX: "广西壮族自治区",
  GZ: "贵州省",
  HA: "河南省",
  HB: "湖北省",
  HE: "河北省",
  HI: "海南省",
  HL: "黑龙江省",
  HN: "湖南省",
  JL: "吉林省",
  JS: "江苏省",
  JX: "江西省",
  LN: "辽宁省",
  NM: "内蒙古自治区",
  NX: "宁夏回族自治区",
  QH: "青海省",
  SC: "四川省",
  SD: "山东省",
  SN: "陕西省",
  SX: "山西省",
  SH: "上海市",
  TJ: "天津市",
  XJ: "新疆维吾尔自治区",
  XZ: "西藏自治区",
  YN: "云南省",
  ZJ: "浙江省",
  HK: "香港特别行政区",
  MO: "澳门特别行政区",
  // IOC 常用中文称谓，热力等中立展示
  TW: "中华台北",
};

/** 与 `CN_SUBDIVISION_ZH` 同键，英文界面展示用（`Intl.DisplayNames` 不支持 CN-XX 子码）。 */
const CN_SUBDIVISION_EN: Record<string, string> = {
  AH: "Anhui",
  BJ: "Beijing",
  CQ: "Chongqing",
  FJ: "Fujian",
  GD: "Guangdong",
  GS: "Gansu",
  GX: "Guangxi",
  GZ: "Guizhou",
  HA: "Henan",
  HB: "Hubei",
  HE: "Hebei",
  HI: "Hainan",
  HL: "Heilongjiang",
  HN: "Hunan",
  JL: "Jilin",
  JS: "Jiangsu",
  JX: "Jiangxi",
  LN: "Liaoning",
  NM: "Inner Mongolia",
  NX: "Ningxia",
  QH: "Qinghai",
  SC: "Sichuan",
  SD: "Shandong",
  SN: "Shaanxi",
  SX: "Shanxi",
  SH: "Shanghai",
  TJ: "Tianjin",
  XJ: "Xinjiang",
  XZ: "Tibet",
  YN: "Yunnan",
  ZJ: "Zhejiang",
  HK: "Hong Kong",
  MO: "Macau",
  TW: "Chinese Taipei",
};

const CN_ZH_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CN_SUBDIVISION_ZH).map(([code, zh]) => [zh, code])
);

/** 存储里仍可能出现的旧称 / 变体 → 与 `TW` 子码同一套 IOC 展示。 */
const CN_ZH_TW_ALIASES = new Set([
  "台湾省",
  "台湾",
  "台灣",
  "台灣省",
  "臺灣",
  "臺灣省",
]);

/**
 * 是否为热力展示中 TW 相关地名的常见片段（与 IOC 用名「中华台北 / Chinese Taipei」映射一致；不匹配单独城市名如「台北」）。
 * 含已规范为中华台北 / Chinese Taipei 的写法，便于幂等展示。
 */
export function matchTaiwanIocSegment(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^中华台北$/u.test(t) || /^中華台北$/u.test(t)) return true;
  if (/^chinese taipei$/i.test(t)) return true;
  if (/[\u4e00-\u9fff]/.test(t)) {
    return (
      /^台湾省?$/u.test(t) ||
      /^台灣省?$/u.test(t) ||
      /^臺灣省?$/u.test(t) ||
      /^臺灣$/u.test(t)
    );
  }
  const k = t.toLowerCase();
  return k === "taiwan" || k === "tw";
}

/** IOC「中华台北 / Chinese Taipei」称谓（热力等中立展示，与 `Intl` 对 TW 的译名区分）。 */
export function taiwanIocLocaleLabel(locale: AppLocale): string {
  return locale === "en" ? CN_SUBDIVISION_EN.TW : CN_SUBDIVISION_ZH.TW;
}

/** 中文省级称谓（与存储的 `voter_region` 首段一致）→ ISO 3166-2 子码（如 GD、BJ） */
export function cnZhProvinceNameToSubdivisionCode(name: string): string | null {
  const k = name.trim();
  if (!k) return null;
  if (CN_ZH_TW_ALIASES.has(k)) return "TW";
  return CN_ZH_NAME_TO_CODE[k] ?? null;
}

/** 中文省级称谓 → 英文常用名（用于英文 UI 热力条等）。 */
export function cnZhProvinceNameToEnLabel(name: string): string | null {
  const code = cnZhProvinceNameToSubdivisionCode(name);
  if (!code) return null;
  return CN_SUBDIVISION_EN[code] ?? null;
}

/**
 * 英文省级短名（与 `CN_SUBDIVISION_EN` 一致，如 Guangdong、Inner Mongolia）→ 中文省级称谓。
 * 用于「中国｜…」路径里夹杂的英文省名片段。
 */
export function cnEnProvinceLabelToZh(enLabel: string): string | null {
  const k = enLabel.trim().toLowerCase().replace(/\s+province$/i, "").trim();
  if (!k) return null;
  if (k === "taiwan" || k === "chinese taipei") return CN_SUBDIVISION_ZH.TW;
  for (const [code, en] of Object.entries(CN_SUBDIVISION_EN)) {
    if (en.toLowerCase() === k) return CN_SUBDIVISION_ZH[code];
  }
  return null;
}

/** 直辖市：有省名展示时一般不再重复缀英文城市名 */
export const CN_MUNICIPALITY_ZH = new Set(["北京市", "天津市", "上海市", "重庆市"]);

export function cnIso31662CodeToZh(code: string | null | undefined): string | null {
  if (!code) return null;
  const k = code.trim().toUpperCase();
  if (!k) return null;
  return CN_SUBDIVISION_ZH[k] ?? null;
}

/** 从 Vercel / Cloudflare 等头里取出「CN-」后的子码，如 HB、GD、NM */
export function normalizeChinaRegionCode(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (t.startsWith("CN-")) t = t.slice(3);
  t = t.replace(/[^A-Z]/g, "");
  if (t.length < 2 || t.length > 3) return null;
  return t;
}
