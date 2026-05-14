import type { AppLocale } from "@/lib/i18n/types";
import { cnZhProvinceNameToEnLabel } from "@/lib/cn-region-iso";
import { translateStatic } from "@/lib/i18n/translate-static";

/** 与 `regionFromHeaders` 一致的分隔符（U+FF5A） */
const SEP = "｜";

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

/** 英文 UI：`中国｜广东省｜深圳` → `China｜Guangdong｜深圳`（城市段无映射则保留原样）。 */
function formatChinaStoredForEn(stored: string): string {
  const body = chinaBodyAfterPrefix(stored);
  if (!body) return "China";
  const parts = body.split(SEP).filter(Boolean);
  const first = parts[0] ?? "";
  const enFirst = cnZhProvinceNameToEnLabel(first) ?? first;
  const tail = parts.slice(1);
  if (tail.length === 0) return `China${SEP}${enFirst}`;
  return `China${SEP}${enFirst}${SEP}${tail.join(SEP)}`;
}

/**
 * 将存储的 `voter_region` 转为界面展示文案。
 * - `zh`：中国路径保持中文；其它国家 ISO alpha-2 优先中文国家名。
 * - `en`：国家名仅用英文；中国路径为 `China｜…`，省级段用英文行政区名。
 */
export function formatRegionHeatLabel(
  stored: string | null | undefined,
  locale: AppLocale = "zh"
): string {
  const s = (stored ?? "").trim();
  if (!s || s === "未知") return translateStatic(locale, "region.unknown");

  if (s.startsWith("中国")) {
    return locale === "en" ? formatChinaStoredForEn(s) : s;
  }

  const parts = s.split(SEP);
  const head = (parts[0] ?? "").trim().toUpperCase();

  if (head === "CN") {
    const rest = parts.slice(1).filter(Boolean).join(SEP);
    if (locale === "en") {
      return rest ? `China${SEP}${rest}` : "China";
    }
    return rest ? `中国${SEP}${rest}` : "中国";
  }

  if (/^[A-Z]{2}$/.test(head)) {
    const countryLabel = countryLabelFromIso2(head, locale);
    if (parts.length === 1) return countryLabel;
    const rest = parts.slice(1).join(SEP);
    return `${countryLabel}${SEP}${rest}`;
  }

  return s;
}
