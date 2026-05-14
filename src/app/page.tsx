import Link from "next/link";
import { listMatchesHome } from "@/server/match-service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await listMatchesHome();
  const hot = [...rows].sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
  const latest = [...rows].sort(
    (a, b) => new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime()
  ).slice(0, 12);
  const regions = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.match.created_ip_region ?? "未知";
    if (!regions.has(k)) regions.set(k, []);
    regions.get(k)!.push(r);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10">
      <header className="space-y-4 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/80">Image Match</p>
        <h1 className="text-balance text-4xl font-semibold text-white md:text-5xl">
          图片对战 · Elo 实时排名
        </h1>
        <p className="max-w-2xl text-pretty text-white/60">
          无需登录创建比赛，匿名 1v1 投票，排行榜随对战实时更新。适合摄影评选、Logo PK、AI 生图对比。
        </p>
        <div className="flex flex-wrap justify-center gap-3 md:justify-start">
          <Link
            href="/create"
            className="rounded-xl bg-cyan-400/90 px-5 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
          >
            创建比赛
          </Link>
          <Link
            href="#hot"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/85 backdrop-blur transition hover:bg-white/10"
          >
            热门榜单
          </Link>
        </div>
      </header>

      <section id="hot" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-medium text-white">热门进行中</h2>
          <span className="text-xs text-white/40">热度 = 24h 投票×0.5 + 活跃×0.3 + 浏览×0.2</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hot.map((r) => (
            <MatchCard key={r.match.id} row={r} highlight />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">最新创建</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((r) => (
            <MatchCard key={r.match.id} row={r} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">按创建者地区</h2>
        <div className="flex flex-wrap gap-2">
          {[...regions.keys()].slice(0, 16).map((region) => (
            <a
              key={region}
              href={`#region-${encodeURIComponent(region)}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur hover:border-cyan-400/30"
            >
              {region}
            </a>
          ))}
        </div>
        {[...regions.entries()].slice(0, 8).map(([region, list]) => (
          <div key={region} id={`region-${encodeURIComponent(region)}`} className="space-y-2">
            <h3 className="text-sm text-white/70">{region}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {list
                .sort((a, b) => b.hotScore - a.hotScore)
                .slice(0, 4)
                .map((r) => (
                  <MatchCard key={r.match.id} row={r} compact />
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function MatchCard({
  row,
  highlight,
  compact,
}: {
  row: Awaited<ReturnType<typeof listMatchesHome>>[number];
  highlight?: boolean;
  compact?: boolean;
}) {
  const { match, votes24h, activeVoters, hotScore } = row;
  const cover = match.cover_image;
  return (
    <Link
      href={`/m/${match.slug}`}
      className={cn(
        "group flex overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl shadow-black/30 backdrop-blur transition hover:border-cyan-400/35",
        compact ? "flex-row items-center gap-3 p-2" : "flex-col"
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-black/40",
          compact ? "h-14 w-14 rounded-xl" : "aspect-[16/9] w-full"
        )}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/35">无封面</div>
        )}
      </div>
      <div className={cn("min-w-0 flex-1 space-y-1", compact ? "py-1 pr-2" : "p-4")}>
        <div className="truncate font-medium text-white">{match.title}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
          <span>总票 {match.vote_count}</span>
          <span>24h {votes24h}</span>
          <span>活跃 {activeVoters}</span>
          {highlight ? <span className="text-cyan-300/90">热度 {hotScore.toFixed(1)}</span> : null}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-white/35">{match.status}</div>
      </div>
    </Link>
  );
}
