"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ImageRow } from "@/server/match-service";

type Row = { rank: number; image: ImageRow; winRate: number };

export function LiveLeaderboard({
  matchId,
  slug,
  initial,
}: {
  matchId: string;
  slug: string;
  initial: Row[];
}) {
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`images-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "images", filter: `match_id=eq.${matchId}` },
        () => {
          void fetch(`/api/rankings?slug=${encodeURIComponent(slug)}`)
            .then((r) => r.json())
            .then((j) => {
              if (j.rankings) setRows(j.rankings as Row[]);
            })
            .catch(() => {});
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, slug]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.image.elo_rating - a.image.elo_rating).map((r, i) => ({ ...r, rank: i + 1 })),
    [rows]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-sm font-medium text-white/85">实时人气</div>
        <p className="mt-0.5 text-[11px] text-white/45">按大家的选择排序；数据随投票更新。</p>
      </div>
      <ul className="divide-y divide-white/5">
        {sorted.map((r) => {
          const pct = r.image.battle_count > 0 ? Math.round(r.winRate * 100) : 0;
          return (
            <li key={r.image.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm">
              <span className="w-6 shrink-0 text-right text-base font-semibold tabular-nums text-cyan-300/90">
                {r.rank}
              </span>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-sm">
                <Image
                  src={r.image.thumb_url || r.image.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="44px"
                  quality={75}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-white/72">
                  胜率 <span className="font-medium text-white/90">{pct}%</span>
                  <span className="mx-1 text-white/25">·</span>
                  <span className="text-white/55">{r.image.battle_count} 场对决</span>
                  <span className="mx-1 text-white/25">·</span>
                  <span className="text-white/55">{r.image.win_count} 胜</span>
                  <span className="text-white/35"> / </span>
                  <span className="text-white/55">{r.image.loss_count} 负</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
