"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityFeedItem } from "@/server/match-service";
import { cn } from "@/lib/utils";

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "刚刚";
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

type Props = {
  slug: string;
  initialItems: ActivityFeedItem[];
  initialRegionCounts: Record<string, number>;
};

export function RecentVotesFeed({ slug, initialItems, initialRegionCounts }: Props) {
  const [items, setItems] = useState(initialItems);
  const [regionCounts, setRegionCounts] = useState(initialRegionCounts);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/matches/${slug}/activity`);
    if (!res.ok) return;
    const j = (await res.json()) as { items: ActivityFeedItem[]; regionCounts: Record<string, number> };
    if (Array.isArray(j.items)) setItems(j.items);
    if (j.regionCounts && typeof j.regionCounts === "object") setRegionCounts(j.regionCounts);
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(t);
  }, [refresh]);

  const regionList = useMemo(
    () => Object.entries(regionCounts).sort((a, b) => b[1] - a[1]),
    [regionCounts]
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
        <p className="text-xs font-medium text-white/50">最近投票来自哪些地区（按票数汇总）</p>
        {regionList.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">还没有人投票，或创建者关闭了投票动态展示。</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {regionList.map(([region, n]) => (
              <span
                key={region}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-950/40 px-2.5 py-1 text-xs text-cyan-100/90"
              >
                <span>{region}</span>
                <span className="rounded-md bg-white/10 px-1.5 font-mono text-[10px] text-white/70">{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">最近大家在选什么</h3>
        <p className="text-xs text-white/45">每条记录是一对图的一次结果：显示其他人点了哪一边（或跳过），以及该次操作的大致地区。</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 py-10 text-center text-sm text-white/45">
          暂无投票记录，来投第一票吧。
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-inner backdrop-blur"
            >
              <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-white/45">
                <span>{relTime(row.created_at)}</span>
                <span className="truncate text-cyan-200/80" title={row.voter_region ?? ""}>
                  {row.voter_region ?? "地区未知"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                <Thumb src={row.left_thumb} highlight={!row.skipped && row.winner_image_id === row.left_image_id} />
                <span className="text-lg font-light text-white/35">vs</span>
                <Thumb src={row.right_thumb} highlight={!row.skipped && row.winner_image_id === row.right_image_id} />
              </div>

              <div className="mt-3 text-center text-sm">
                {row.skipped ? (
                  <span className="text-white/50">有人跳过了这一对</span>
                ) : (
                  <p className="text-white/75">
                    大家选了
                    <span className="mx-1 inline-flex align-middle">
                      {row.winner_thumb ? (
                        <span className="relative inline-block h-10 w-10 overflow-hidden rounded-lg border-2 border-emerald-400/70 shadow-lg shadow-emerald-900/40">
                          <Image src={row.winner_thumb} alt="" fill className="object-cover" sizes="40px" unoptimized />
                        </span>
                      ) : null}
                    </span>
                    <span className="text-emerald-200/90">这一边</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ src, highlight }: { src: string; highlight: boolean }) {
  if (!src) {
    return <div className="h-20 w-20 rounded-xl bg-white/10" />;
  }
  return (
    <div
      className={cn(
        "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-black/30 sm:h-24 sm:w-24",
        highlight ? "border-emerald-400/80 ring-2 ring-emerald-400/30" : "border-white/15"
      )}
    >
      <Image src={src} alt="" fill className="object-cover" sizes="96px" unoptimized />
    </div>
  );
}
