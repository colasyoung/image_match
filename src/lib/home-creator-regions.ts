import type { AppLocale } from "@/lib/i18n/types";

/** 与 `match.created_ip_region` 缺省一致 */
export const CREATOR_REGION_UNKNOWN = "未知";

/** 首页「按创建者地区」最多展示的地区数（导航与区块一致） */
export const HOME_MAX_CREATOR_REGIONS = 12;

/** 每个地区块内最多展示的场次数 */
export const HOME_MAX_MATCHES_PER_REGION = 6;

export type CreatorRegionRow = { hotScore: number; match: { vote_count?: number | null } };

/**
 * 地区块顺序：场次多的在前；「未知」固定垫后；再按总票、峰值热度、名称排序。
 */
export function sortCreatorRegionEntries<T extends CreatorRegionRow>(
  entries: [string, T[]][],
  locale: AppLocale
): [string, T[]][] {
  const sumVotes = (list: T[]) => list.reduce((s, r) => s + (r.match.vote_count ?? 0), 0);
  const maxHot = (list: T[]) => list.reduce((m, r) => Math.max(m, r.hotScore), 0);

  return [...entries].sort((a, b) => {
    const [ka, la] = a;
    const [kb, lb] = b;
    const ua = ka === CREATOR_REGION_UNKNOWN;
    const ub = kb === CREATOR_REGION_UNKNOWN;
    if (ua !== ub) return ua ? 1 : -1;

    const na = la.length;
    const nb = lb.length;
    if (nb !== na) return nb - na;

    const vd = sumVotes(lb) - sumVotes(la);
    if (vd !== 0) return vd;

    const hd = maxHot(lb) - maxHot(la);
    if (hd !== 0) return hd;

    return ka.localeCompare(kb, locale === "zh" ? "zh-Hans-CN" : "en", { sensitivity: "base" });
  });
}
