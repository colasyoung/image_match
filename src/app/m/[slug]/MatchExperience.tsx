"use client";

import { useEffect } from "react";
import { MatchDuel } from "@/components/MatchDuel";
import { LiveLeaderboard } from "@/components/LiveLeaderboard";
import { EloHistoryChart } from "@/components/EloHistoryChart";
import type { ImageRow, MatchRow } from "@/server/match-service";

type Row = { rank: number; image: ImageRow; winRate: number };

export function MatchExperience({
  slug,
  match,
  images,
  rankings,
  ratingHistory,
  recentRegions,
}: {
  slug: string;
  match: MatchRow;
  images: ImageRow[];
  rankings: Row[];
  ratingHistory: { image_id: string; old_rating: number; new_rating: number; created_at: string }[];
  recentRegions: { voter_region: string | null }[];
}) {
  useEffect(() => {
    void fetch(`/api/matches/${slug}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  const voting = match.status === "active";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">{match.status}</span>
            <span>总投票 {match.vote_count}</span>
            <span>浏览 {match.view_count}</span>
            {match.created_ip_region ? <span>来自 {match.created_ip_region}</span> : null}
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{match.title}</h1>
          {match.description ? <p className="mt-2 text-sm text-white/55">{match.description}</p> : null}
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-white/80">1v1 对战</h2>
          <MatchDuel slug={slug} disabled={!voting} />
        </section>

        {match.show_rating_history ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-white/80">Elo 历史</h2>
            <EloHistoryChart history={ratingHistory} imageIds={images.map((i) => i.id)} />
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-white/80">最近投票来源（脱敏地区）</h2>
          <div className="flex flex-wrap gap-2">
            {recentRegions.length === 0 ? (
              <span className="text-sm text-white/45">暂无数据</span>
            ) : (
              recentRegions.map((r, i) => (
                <span
                  key={`${r.voter_region}-${i}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70"
                >
                  {r.voter_region ?? "未知"}
                </span>
              ))
            )}
          </div>
        </section>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-8 lg:w-80">
        {match.realtime_leaderboard ? (
          <LiveLeaderboard key={`${match.id}-${slug}`} matchId={match.id} slug={slug} initial={rankings} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55 backdrop-blur">
            创建者已关闭实时排行榜展示。
          </div>
        )}
      </aside>
    </div>
  );
}
