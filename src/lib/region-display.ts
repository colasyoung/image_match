import type { AppLocale } from "@/lib/i18n/types";
import { cnChinaPathLatinSegmentToZh } from "@/lib/cn-city-en-to-zh";
import {
  cnZhProvinceNameToEnLabel,
  matchTaiwanIocSegment,
  taiwanIocLocaleLabel,
} from "@/lib/cn-region-iso";
import { translateStatic } from "@/lib/i18n/translate-static";

/**
 * 地区热力等 UI 用的展示串：以 ISO 国家码、ISO 3166-2:CN 子码、以及 IOC 对 TW 的常用中英文用名为准；
 * 港澳采用常见「中国香港 / 中国澳门」及对应英文写法。仅为粗略统计展示，不构成任何领土或政治主张。
 */

/** 与 `regionFromHeaders` 一致的分隔符（U+FF5A） */
const SEP = "｜";

/** 将 ASCII 竖线与全角「｜」统一，避免 `中国|Beijing`、`CN|Beijing` 无法按段解析。 */
function normalizeRegionSeparators(raw: string): string {
  return raw.replace(/\|/g, SEP);
}

let zhRegionNames: Intl.DisplayNames | null = null;
let enRegionNames: Intl.DisplayNames | null = null;

function zhRegions(): Intl.DisplayNames {
  return (zhRegionNames ??= new Intl.DisplayNames(["zh-CN"], { type: "region" }));
}

function enRegions(): Intl.DisplayNames {
  return (enRegionNames ??= new Intl.DisplayNames(["en"], { type: "region" }));
}

function countryLabelFromIso2(code: string, locale: AppLocale): string {
  const c = code.toUpperCase();
  if (c === "TW") return taiwanIocLocaleLabel(locale);
  if (locale === "en") {
    return enRegions().of(c) ?? c;
  }
  const zh = zhRegions().of(c);
  const en = enRegions().of(c) ?? c;
  if (zh && zh !== c) return zh;
  return en;
}

function chinaBodyAfterPrefix(stored: string): string {
  if (!stored.startsWith("中国")) return "";
  let rest = stored.slice(2);
  if (rest.startsWith(SEP)) rest = rest.slice(1);
  return rest.trim();
}

/** 中文界面：港澳单独称谓，与「澳门」「香港」互不混淆。 */
const LABEL_HK_ZH = "中国香港";
const LABEL_MO_ZH = "中国澳门";
const LABEL_HK_EN = "Hong Kong, China";
const LABEL_MO_EN = "Macau, China";

function microstateDisplayLabel(iso: string, locale: AppLocale): string {
  const u = iso.toUpperCase();
  if (locale === "zh") {
    if (u === "HK") return LABEL_HK_ZH;
    if (u === "MO") return LABEL_MO_ZH;
  } else {
    if (u === "HK") return LABEL_HK_EN;
    if (u === "MO") return LABEL_MO_EN;
  }
  return countryLabelFromIso2(iso, locale);
}

/** 仅香港语义；若含澳门相关字样则排除，避免 HK/MO 串台。 */
function isHongKongSegment(part: string): boolean {
  const t = part.trim();
  if (!t) return false;
  if (/澳门|澳門|macau|macao|\bmo\b/i.test(t)) return false;
  return (
    /^香港$/u.test(t) ||
    /^香港特别行政区/u.test(t) ||
    /^hong kong$/i.test(t) ||
    /^hk$/i.test(t)
  );
}

/** 仅澳门语义；若含香港相关字样则排除。 */
function isMacauSegment(part: string): boolean {
  const t = part.trim();
  if (!t) return false;
  if (/香港|hong kong|\bhk\b/i.test(t)) return false;
  return (
    /^澳门$/u.test(t) ||
    /^澳門$/u.test(t) ||
    /^澳门特别行政区/u.test(t) ||
    /^澳門特別行政區/u.test(t) ||
    /^macau$/i.test(t) ||
    /^macao$/i.test(t) ||
    /^mo$/i.test(t)
  );
}

/**
 * 城邦 / 微型国家或地区：存储里「国家｜城市」语义重复时只显示 Intl 国家/地区名（如摩纳哥、梵蒂冈、港澳等）。
 * 键为 ISO 3166-1 alpha-2；值为各段允许的写法（大小写不敏感，中文按常见称谓）。
 * 香港 / 澳门单独用互斥规则识别，避免混淆。
 */
const MICROSTATE_SEGMENT_PATTERNS: Record<string, RegExp[]> = {
  SG: [/^新加坡$/u, /^singapore$/i, /^sg$/i],
  MC: [/^摩纳哥$/u, /^monaco$/i, /^mc$/i],
  VA: [/^梵蒂冈/u, /^梵蒂冈城/u, /^vatican city$/i, /^vatican$/i, /^holy see$/i, /^va$/i],
  SM: [/^圣马力诺/u, /^圣马力诺共和国/u, /^san marino$/i, /^sm$/i],
  AD: [/^安道尔/u, /^安道爾/u, /^andorra$/i, /^ad$/i],
  LI: [/^列支敦士登/u, /^liechtenstein$/i, /^li$/i],
  GI: [/^直布罗陀/u, /^直布羅陀/u, /^gibraltar$/i, /^gi$/i],
  LU: [/^卢森堡/u, /^盧森堡/u, /^luxembourg( city)?$/i, /^lu$/i],
  MT: [/^马耳他/u, /^馬耳他/u, /^malta$/i, /^mt$/i],
};

/** 解析顺序：先香港、再澳门，其余任意；防止同一串被误归到错误地区。 */
const MICROSTATE_ISO2_ORDER = [
  "HK",
  "MO",
  ...Object.keys(MICROSTATE_SEGMENT_PATTERNS),
] as const;

const MICROSTATE_ISO2 = new Set<string>(MICROSTATE_ISO2_ORDER);

function partMatchesMicrostatePatterns(part: string, iso: string): boolean {
  if (iso === "HK") return isHongKongSegment(part);
  if (iso === "MO") return isMacauSegment(part);
  const patterns = MICROSTATE_SEGMENT_PATTERNS[iso];
  if (!patterns) return false;
  const p = part.trim();
  return patterns.some((re) => re.test(p));
}

/** 若每一段都可视为同一城邦/微型地区的不同写法，则折叠为单一展示名。 */
function collapseMicrostatePath(stored: string, locale: AppLocale): string | null {
  const parts = stored.split(SEP).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  for (const iso of MICROSTATE_ISO2_ORDER) {
    if (parts.every((part) => partMatchesMicrostatePatterns(part, iso))) {
      return microstateDisplayLabel(iso, locale);
    }
  }
  return null;
}

/** 中文 UI：中国路径下把常见英文省/市片段换成中文；港澳段固定为「中国香港」「中国澳门」，与澳门段互斥判断。 */
function formatChinaStoredForZh(stored: string): string {
  const body = chinaBodyAfterPrefix(stored);
  if (!body) return "中国";
  const parts = body.split(SEP).filter(Boolean);
  const mapped = parts.map((p) => {
    const z = cnChinaPathLatinSegmentToZh(p);
    if (isHongKongSegment(p) || isHongKongSegment(z)) return LABEL_HK_ZH;
    if (isMacauSegment(p) || isMacauSegment(z)) return LABEL_MO_ZH;
    return z;
  });
  return `中国${SEP}${mapped.join(SEP)}`;
}

/** 英文 UI：中国路径下省级段译名；港澳段固定为 `Hong Kong, China` / `Macau, China`（与中文路径互斥规则一致）。 */
function mapChinaPathPartsForEn(parts: string[]): string[] {
  return parts.map((raw, idx) => {
    const p = raw.trim();
    const z = cnChinaPathLatinSegmentToZh(p);
    if (isHongKongSegment(p) || isHongKongSegment(z)) return LABEL_HK_EN;
    if (isMacauSegment(p) || isMacauSegment(z)) return LABEL_MO_EN;
    if (matchTaiwanIocSegment(p)) return taiwanIocLocaleLabel("en");
    if (idx === 0) return cnZhProvinceNameToEnLabel(p) ?? p;
    return p;
  });
}

function formatChinaStoredForEn(stored: string): string {
  const body = chinaBodyAfterPrefix(stored);
  if (!body) return "China";
  const parts = body.split(SEP).filter(Boolean);
  return `China${SEP}${mapChinaPathPartsForEn(parts).join(SEP)}`;
}

/**
 * 将存储的 `voter_region` 转为界面展示文案。
 * - `zh`：以 `中国` 或 `CN` 开头的路径，后续英文省/市/子码会尽量转为中文；进入函数时会把 ASCII `|` 统一为 `｜`。
 * - `en`：国家名仅用英文；中国路径为 `China｜…`，省级段用英文行政区名。
 * - 城邦 / 微型地区：港澳与其它城邦；香港、澳门**分别**识别（互斥），中文固定为「中国香港」「中国澳门」，英文为 `Hong Kong, China` / `Macau, China`。
 * - `TW` 及常见「台湾 / Taiwan」片段：采用国际奥委会用语「中华台北」「Chinese Taipei」，避免依赖 `Intl` 对政治实体的译法。
 */
export function formatRegionHeatLabel(
  stored: string | null | undefined,
  locale: AppLocale = "zh"
): string {
  const s = normalizeRegionSeparators((stored ?? "").trim());
  if (!s || s === "未知") return translateStatic(locale, "region.unknown");

  const microCollapsed = collapseMicrostatePath(s, locale);
  if (microCollapsed !== null) return microCollapsed;

  if (s.startsWith("中国")) {
    return locale === "en" ? formatChinaStoredForEn(s) : formatChinaStoredForZh(s);
  }

  const parts = s.split(SEP);
  const head = (parts[0] ?? "").trim().toUpperCase();

  if (head === "CN") {
    const rest = parts.slice(1).filter(Boolean).join(SEP);
    if (locale === "en") {
      if (!rest) return "China";
      const restParts = rest.split(SEP).filter(Boolean);
      return `China${SEP}${mapChinaPathPartsForEn(restParts).join(SEP)}`;
    }
    if (!rest) return "中国";
    const restParts = rest.split(SEP).filter(Boolean);
    const mapped = restParts.map((p) => {
      const z = cnChinaPathLatinSegmentToZh(p);
      if (isHongKongSegment(p) || isHongKongSegment(z)) return LABEL_HK_ZH;
      if (isMacauSegment(p) || isMacauSegment(z)) return LABEL_MO_ZH;
      return z;
    });
    return `中国${SEP}${mapped.join(SEP)}`;
  }

  if (/^[A-Z]{2}$/.test(head)) {
    if (MICROSTATE_ISO2.has(head)) {
      return microstateDisplayLabel(head, locale);
    }
    const countryLabel = countryLabelFromIso2(head, locale);
    if (parts.length === 1) return countryLabel;
    const rest = parts.slice(1).join(SEP);
    return `${countryLabel}${SEP}${rest}`;
  }

  const twMapped = s
    .split(SEP)
    .map((seg) =>
      matchTaiwanIocSegment(seg.trim()) ? taiwanIocLocaleLabel(locale) : seg
    )
    .join(SEP);
  if (twMapped !== s) return twMapped;

  return s;
}
