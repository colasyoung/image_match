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
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">地区热度（按票）</p>
        {regionList.length === 0 ? (
          <p className="mt-1 text-xs text-white/38">暂无投票数据</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {regionList.map(([region, n]) => (
              <span
                key={region}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
              >
                <span className="max-w-[120px] truncate">{region}</span>
                <span className="font-mono text-white/45">{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-white/85">最近大家在选什么</h3>
        <p className="mt-0.5 text-[11px] text-white/42">每条是一条真实投票：谁、选了哪边、大约从哪来。</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 py-8 text-center text-xs text-white/40">
          还没有记录，来投第一票吧。
        </div>
      ) : (
        <ul className="flex max-h-[min(420px,55vh)] flex-col gap-1.5 overflow-y-auto pr-1">
          {items.map((row) => (
            <VoteStrip key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VoteStrip({ row }: { row: ActivityFeedItem }) {
  const region = row.voter_region ?? "未知地区";
  const t = relTime(row.created_at);

  if (row.skipped) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-2 py-1.5 pl-2.5 text-[11px] text-white/55">
        <Mini src={row.left_thumb} />
        <span className="text-white/30">vs</span>
        <Mini src={row.right_thumb} />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-white/65">来自 {region}</span> 的用户跳过了这一对
        </span>
        <time className="shrink-0 tabular-nums text-white/35">{t}</time>
      </li>
    );
  }

  const pickedLeft = row.winner_image_id === row.left_image_id;
  const winnerSrc = pickedLeft ? row.left_thumb : row.right_thumb;

  return (
    <li className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-2 py-1.5 pl-2.5">
      <Mini src={row.left_thumb} ring={pickedLeft} />
      <span className="shrink-0 text-[10px] text-white/28">vs</span>
      <Mini src={row.right_thumb} ring={!pickedLeft} />
      <div className="min-w-0 flex-1 text-[11px] leading-snug">
        <span className="text-white/60">来自 {region}</span>
        <span className="text-white/45"> 的用户选了</span>
        <span className="ml-1 inline-flex translate-y-0.5 align-middle">
          {winnerSrc ? (
            <span className="relative inline-block h-7 w-7 overflow-hidden rounded-md border border-emerald-500/40 shadow-sm shadow-emerald-900/30">
              <Image
                src={winnerSrc}
                alt=""
                fill
                className="object-cover"
                sizes="28px"
                quality={70}
                loading="lazy"
              />
            </span>
          ) : null}
        </span>
        <span className="text-emerald-200/85"> 这一边</span>
      </div>
      <time className="shrink-0 tabular-nums text-[10px] text-white/35">{t}</time>
    </li>
  );
}

function Mini({ src, ring }: { src: string; ring?: boolean }) {
  if (!src) return <div className="h-8 w-8 shrink-0 rounded-md bg-white/10" />;
  return (
    <div
      className={cn(
        "relative h-8 w-8 shrink-0 overflow-hidden rounded-md border bg-black/30",
        ring ? "border-emerald-400/70 ring-1 ring-emerald-400/25" : "border-white/12"
      )}
    >
      <Image src={src} alt="" fill className="object-cover" sizes="32px" quality={70} loading="lazy" />
    </div>
  );
}
