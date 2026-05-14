import { NextResponse } from "next/server";
import { listMatchesHome } from "@/server/match-service";

export async function GET() {
  try {
    const rows = await listMatchesHome();
    const sortedHot = [...rows].sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
    const sortedLatest = [...rows].sort(
      (a, b) => new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime()
    );
    const byRegion = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.match.created_ip_region ?? "未知";
      if (!byRegion.has(key)) byRegion.set(key, []);
      byRegion.get(key)!.push(r);
    }
    return NextResponse.json({
      hot: sortedHot.map(stripMatch),
      latest: sortedLatest.slice(0, 12).map(stripMatch),
      regions: Object.fromEntries(
        [...byRegion.entries()].map(([k, v]) => [k, v.sort((a, b) => b.hotScore - a.hotScore).slice(0, 8).map(stripMatch)])
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
}) {
  const match = { ...row.match };
  delete match.manage_token;
  return {
    match,
    votes24h: row.votes24h,
    activeVoters: row.activeVoters,
    hotScore: row.hotScore,
    hotScoreAlt: row.hotScoreAlt,
  };
}
