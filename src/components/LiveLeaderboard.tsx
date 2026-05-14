"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useLocale } from "@/contexts/LocaleProvider";
import { FETCH_LOAD_TIMEOUT_MS, fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ImageRow } from "@/server/match-service";
import { cn } from "@/lib/utils";

type Row = { rank: number; image: ImageRow; winRate: number };

function fullImageSrc(img: ImageRow): string {
  return (img.image_url || img.thumb_url || "").trim();
}

export function LiveLeaderboard({
  matchId,
  slug,
  initial,
  onPreviewChange,
}: {
  matchId: string;
  slug: string;
  initial: Row[];
  /** 大图预览打开/关闭时通知父级，用于弱化页面其它区域（如动态 feed）。 */
  onPreviewChange?: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const [rows, setRows] = useState(initial);
  const [rankingsRefreshing, setRankingsRefreshing] = useState(false);
  const [preview, setPreview] = useState<{ rank: number; image: ImageRow } | null>(null);
  const [previewFullLoaded, setPreviewFullLoaded] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const rankingsRefreshDepthRef = useRef(0);

  const pullRankings = useCallback(async () => {
    rankingsRefreshDepthRef.current += 1;
    setRankingsRefreshing(true);
    const url = `/api/rankings?slug=${encodeURIComponent(slug)}`;
    const run = async () => {
      const res = await fetchWithTimeout(url, undefined, FETCH_LOAD_TIMEOUT_MS);
      if (!res.ok) return;
      const j = (await res.json()) as { rankings?: Row[] };
      if (j.rankings) setRows(j.rankings);
    };
    try {
      try {
        await run();
      } catch (e) {
        if (isAbortError(e)) {
          try {
            await run();
          } catch {
            /* second stall: leave rows unchanged */
          }
        }
      }
    } finally {
      rankingsRefreshDepthRef.current -= 1;
      if (rankingsRefreshDepthRef.current <= 0) {
        rankingsRefreshDepthRef.current = 0;
        setRankingsRefreshing(false);
      }
    }
  }, [slug]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.image.elo_rating - a.image.elo_rating).map((r, i) => ({ ...r, rank: i + 1 })),
    [rows]
  );

  const previewSrc = useMemo(() => (preview ? fullImageSrc(preview.image) : ""), [preview]);

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    onPreviewChange?.(Boolean(preview));
  }, [preview, onPreviewChange]);

  useEffect(() => {
    return () => {
      onPreviewChange?.(false);
    };
  }, [onPreviewChange]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`images-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "images", filter: `match_id=eq.${matchId}` },
        () => {
          void pullRankings();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, slug, pullRankings]);

  useEffect(() => {
    if (!preview) {
      setPreviewFullLoaded(false);
      setPreviewLoadError(false);
      return;
    }
    setPreviewFullLoaded(false);
    setPreviewLoadError(false);
  }, [preview, previewSrc]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [preview]);

  const previewOverlay =
    preview && previewSrc ? (
      <div
        className="fixed inset-0 z-[200] flex flex-col bg-black/88 backdrop-blur-md"
        role="presentation"
        onClick={() => setPreview(null)}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 px-3 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="min-w-0 max-w-[min(70vw,20rem)] pt-0.5 text-xs leading-snug text-white/55">
            {t("leaderboard.previewRank", { rank: preview.rank })}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            onClick={() => setPreview(null)}
          >
            {t("leaderboard.close")}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-4">
          <div
            className={cn(
              "relative flex max-h-full max-w-full items-center justify-center",
              !previewFullLoaded && !previewLoadError && "min-h-[min(40vh,360px)] min-w-[min(85vw,280px)]"
            )}
            role="dialog"
            aria-modal="true"
            aria-busy={!previewLoadError && !previewFullLoaded}
            aria-label={t("leaderboard.ariaPreview")}
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoadError ? (
              <div className="max-w-md rounded-xl border border-amber-400/35 bg-amber-950/40 px-5 py-6 text-center text-sm text-amber-100/95">
                {t("leaderboard.previewLoadFail")}
              </div>
            ) : (
              <>
                {!previewFullLoaded ? (
                  <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 rounded-lg bg-black/55">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400/90" aria-hidden />
                    <span className="text-sm font-medium text-white/65">{t("leaderboard.previewLoading")}</span>
                  </div>
                ) : null}
                <Image
                  key={previewSrc}
                  src={previewSrc}
                  alt=""
                  width={preview.image.width ?? 1600}
                  height={preview.image.height ?? 1600}
                  className={cn(
                    "h-auto max-h-[min(78vh,1080px)] w-auto max-w-[min(96vw,1200px)] rounded-lg border border-white/10 object-contain shadow-2xl transition-opacity duration-300",
                    !previewFullLoaded && "opacity-0"
                  )}
                  sizes="(max-width: 1200px) 96vw, 1200px"
                  quality={90}
                  priority
                  onLoadingComplete={() => setPreviewFullLoaded(true)}
                  onError={() => {
                    setPreviewLoadError(true);
                    setPreviewFullLoaded(true);
                  }}
                />
              </>
            )}
          </div>
        </div>
        <p className="pointer-events-none shrink-0 px-4 pb-5 pt-1 text-center text-[11px] leading-snug text-white/40">
          {t("leaderboard.tapBackdrop")}
        </p>
      </div>
    ) : null;

  return (
    <>
      {portalReady && previewOverlay ? createPortal(previewOverlay, document.body) : null}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition-[opacity,filter] duration-200",
          preview && "pointer-events-none opacity-40 blur-[1px]"
        )}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-white/85">{t("leaderboard.title")}</div>
            {rankingsRefreshing ? (
              <span className="text-[10px] font-medium tabular-nums text-cyan-300/80">
                {t("leaderboard.refreshing")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-white/45">{t("leaderboard.subtitle")}</p>
        </div>
        <ul className="divide-y divide-white/5">
        {sorted.map((r) => {
          const pct = r.image.battle_count > 0 ? Math.round(r.winRate * 100) : 0;
          return (
            <li key={r.image.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm">
              <span className="w-6 shrink-0 text-right text-base font-semibold tabular-nums text-cyan-300/90">
                {r.rank}
              </span>
              <button
                type="button"
                className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-sm outline-none ring-offset-2 ring-offset-zinc-950 transition hover:border-white/25 focus-visible:ring-2 focus-visible:ring-cyan-400/55"
                aria-label={t("leaderboard.viewLarge", { rank: r.rank })}
                onClick={() => {
                  const src = fullImageSrc(r.image);
                  if (src) setPreview({ rank: r.rank, image: r.image });
                }}
              >
                <Image
                  src={r.image.thumb_url || r.image.image_url}
                  alt=""
                  fill
                  className="object-cover transition group-hover:opacity-90"
                  sizes="44px"
                  quality={75}
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-white/72">
                  {t("leaderboard.winRate")} <span className="font-medium text-white/90">{pct}%</span>
                  <span className="mx-1 text-white/25">·</span>
                  <span className="text-white/55">
                    {r.image.battle_count} {t("leaderboard.battles")}
                  </span>
                  <span className="mx-1 text-white/25">·</span>
                  <span className="text-white/55">
                    {r.image.win_count} {t("leaderboard.wins")}
                  </span>
                  <span className="text-white/35"> / </span>
                  <span className="text-white/55">
                    {r.image.loss_count} {t("leaderboard.losses")}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
    </>
  );
}
