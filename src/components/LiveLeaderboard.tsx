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
        <p className="mt-0.5 text-[11px] text-white/45">按大家的选择实时更新顺序（数字越小越靠前）。</p>
      </div>
      <ul className="divide-y divide-white/5">
        {sorted.map((r) => (
          <li key={r.image.id} className="flex items-center gap-3 px-3 py-3 text-sm">
            <span className="w-7 shrink-0 text-right text-lg font-semibold tabular-nums text-cyan-300/90">
              {r.rank}
            </span>
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-md">
              <Image
                src={r.image.thumb_url || r.image.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1 text-xs text-white/40">更受欢迎</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
