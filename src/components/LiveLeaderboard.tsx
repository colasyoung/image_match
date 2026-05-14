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
      <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-white/80">实时排行榜</div>
      <ul className="divide-y divide-white/5">
        {sorted.map((r) => (
          <li key={r.image.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <span className="w-6 text-right text-cyan-300/90">{r.rank}</span>
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
              <Image
                src={r.image.thumb_url || r.image.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-white/90">#{r.image.id.slice(0, 6)}</div>
              <div className="text-xs text-white/45">
                胜率 {(r.winRate * 100).toFixed(0)}% · 场次 {r.image.battle_count}
              </div>
            </div>
            <div className="shrink-0 text-right font-mono text-cyan-200/90">{Math.round(r.image.elo_rating)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
