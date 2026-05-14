"use client";

import { useEffect } from "react";
import { MatchDuel } from "@/components/MatchDuel";
import { LiveLeaderboard } from "@/components/LiveLeaderboard";
import { RecentVotesFeed } from "@/components/RecentVotesFeed";
import type { ActivityFeedItem, ImageRow, MatchRow } from "@/server/match-service";

type Row = { rank: number; image: ImageRow; winRate: number };

export function MatchExperience({
  slug,
  match,
  rankings,
  activity,
}: {
  slug: string;
  match: MatchRow;
  rankings: Row[];
  activity: { items: ActivityFeedItem[]; regionCounts: Record<string, number> };
}) {
  useEffect(() => {
    void fetch(`/api/matches/${slug}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  const voting = match.status === "active";
  const showActivity = match.show_rating_history;

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
          <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
            本页仅供投票与看榜。<strong className="text-white/70">上传/删图、暂停或结束（删除）比赛</strong>
            需在创建时或管理页保存的链接中操作（投票页不含管理入口）。
          </p>
        </header>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-white/85">选你更喜欢的一张</h2>
            <p className="mt-0.5 text-[11px] text-white/45">两张图随机碰面，帮大家筛出更受欢迎的作品。</p>
          </div>
          <MatchDuel slug={slug} disabled={!voting} />
        </section>

        {showActivity ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-white/85">投票动态</h2>
            <RecentVotesFeed
              key={slug}
              slug={slug}
              initialItems={activity.items}
              initialRegionCounts={activity.regionCounts}
            />
          </section>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/45">
            创建者已关闭投票动态与地区汇总展示。
          </p>
        )}
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-8 lg:w-80">
        {match.realtime_leaderboard ? (
          <LiveLeaderboard key={`${match.id}-${slug}`} matchId={match.id} slug={slug} initial={rankings} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55 backdrop-blur">
            创建者已关闭实时人气榜展示。
          </div>
        )}
      </aside>
    </div>
  );
}
