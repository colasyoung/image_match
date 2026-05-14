import { NextResponse } from "next/server";
import { getServerLocale } from "@/lib/i18n/server-locale";
import {
  CREATOR_REGION_UNKNOWN,
  HOME_MAX_CREATOR_REGIONS,
  HOME_MAX_MATCHES_PER_REGION,
  sortCreatorRegionEntries,
} from "@/lib/home-creator-regions";
import { listMatchesHome } from "@/server/match-service";

export async function GET() {
  try {
    const locale = await getServerLocale();
    const rows = await listMatchesHome();
    const sortedHot = [...rows].sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
    const sortedLatest = [...rows].sort(
      (a, b) => new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime()
    );
    const byRegion = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.match.created_ip_region ?? CREATOR_REGION_UNKNOWN;
      if (!byRegion.has(key)) byRegion.set(key, []);
      byRegion.get(key)!.push(r);
    }
    const regionSorted = sortCreatorRegionEntries([...byRegion.entries()], locale).slice(0, HOME_MAX_CREATOR_REGIONS);
    return NextResponse.json({
      hot: sortedHot.map(stripMatch),
      latest: sortedLatest.slice(0, 12).map(stripMatch),
      regions: Object.fromEntries(
        regionSorted.map(([k, v]) => [
          k,
          [...v].sort((a, b) => b.hotScore - a.hotScore).slice(0, HOME_MAX_MATCHES_PER_REGION).map(stripMatch),
        ])
      ),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function stripMatch(row: {
  match: Record<string, unknown>;
  votes24h: number;
  activeVoters: number;
  hotScore: number;
  hotScoreAlt: number;
  listingCover: string | null;
  listingCoverFull: string | null;
}) {
  const match = { ...row.match };
  delete match.manage_token;
  return {
    match,
    votes24h: row.votes24h,
    activeVoters: row.activeVoters,
    hotScore: row.hotScore,
    hotScoreAlt: row.hotScoreAlt,
    listingCover: row.listingCover,
    listingCoverFull: row.listingCoverFull,
  };
}
