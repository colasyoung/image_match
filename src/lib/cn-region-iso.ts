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
  TW: "台湾省",
};

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
