"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/contexts/LocaleProvider";
import { FETCH_LOAD_TIMEOUT_MS, fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";
import { formatRegionHeatLabel } from "@/lib/region-display";
import { publicImageSrc } from "@/lib/public-image-src";
import type { ActivityFeedItem } from "@/server/match-service";
import { cn } from "@/lib/utils";

function relTime(iso: string, t: (path: string, vars?: Record<string, string | number | undefined>) => string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return t("feed.justNow");
  if (s < 60) return t("feed.secondsAgo", { n: s });
  if (s < 3600) return t("feed.minutesAgo", { n: Math.floor(s / 60) });
  if (s < 86400) return t("feed.hoursAgo", { n: Math.floor(s / 3600) });
  return t("feed.daysAgo", { n: Math.floor(s / 86400) });
}

type Props = {
  slug: string;
  initialItems: ActivityFeedItem[];
  initialRegionCounts: Record<string, number>;
};

const ACTIVITY_FEED_MAX = 50;

export function RecentVotesFeed({ slug, initialItems, initialRegionCounts }: Props) {
  const { t, locale } = useLocale();
  const [items, setItems] = useState(() => initialItems.slice(0, ACTIVITY_FEED_MAX));
  const [regionCounts, setRegionCounts] = useState(initialRegionCounts);

  const refresh = useCallback(async () => {
    const url = `/api/matches/${slug}/activity`;
    const run = async () => {
      const res = await fetchWithTimeout(url, undefined, FETCH_LOAD_TIMEOUT_MS);
      if (!res.ok) return;
      const j = (await res.json()) as { items: ActivityFeedItem[]; regionCounts: Record<string, number> };
      if (Array.isArray(j.items)) setItems(j.items.slice(0, ACTIVITY_FEED_MAX));
      if (j.regionCounts && typeof j.regionCounts === "object") setRegionCounts(j.regionCounts);
    };
    try {
      await run();
    } catch (e) {
      if (isAbortError(e)) {
        try {
          await run();
        } catch {
          /* leave previous feed */
        }
      }
    }
  }, [slug]);

  useEffect(() => {
    const id = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(id);
  }, [refresh]);

  const regionList = useMemo(
    () => Object.entries(regionCounts).sort((a, b) => b[1] - a[1]),
    [regionCounts]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">{t("feed.regionHeat")}</p>
        {regionList.length === 0 ? (
          <p className="mt-1 text-xs text-white/38">{t("feed.regionEmpty")}</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {regionList.map(([region, n]) => {
              const label = formatRegionHeatLabel(region, locale);
              return (
                <span
                  key={region}
                  title={label}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
                >
                  <span className="min-w-0 max-w-[min(100%,72vw)] whitespace-normal break-words">{label}</span>
                  <span className="shrink-0 font-mono text-white/45">{n}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-white/85">{t("feed.recentTitle")}</h3>
        <p className="mt-0.5 text-[11px] text-white/42">{t("feed.recentSub")}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 py-8 text-center text-xs text-white/40">
          {t("feed.emptyFeed")}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((row) => (
            <VoteStrip key={row.id} row={row} t={t} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VoteStrip({
  row,
  t,
  locale,
}: {
  row: ActivityFeedItem;
  t: (path: string, vars?: Record<string, string | number | undefined>) => string;
  locale: "zh" | "en";
}) {
  const region = formatRegionHeatLabel(row.voter_region ?? "未知", locale);
  const timeLabel = relTime(row.created_at, t);

  if (row.skipped) {
    const text = t("feed.voteSkipped", { region });
    return (
      <li className="flex flex-col gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-2 py-2 pl-2.5 text-[11px] text-white/55 sm:flex-row sm:items-center sm:gap-2 sm:py-1.5">
        <div className="flex shrink-0 items-center gap-2">
          <Mini src={row.left_thumb} />
          <span className="text-white/30">{t("common.vs")}</span>
          <Mini src={row.right_thumb} />
        </div>
        <div className="flex min-w-0 w-full flex-1 items-start justify-between gap-2 sm:items-baseline">
          <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug" title={text}>
            {text}
          </span>
          <time className="shrink-0 tabular-nums text-white/35">{timeLabel}</time>
        </div>
      </li>
    );
  }

  const pickedLeft = row.winner_image_id === row.left_image_id;
  const text = pickedLeft ? t("feed.votePickedLeft", { region }) : t("feed.votePickedRight", { region });

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-2 py-2 pl-2.5 sm:flex-row sm:items-center sm:gap-2 sm:py-1.5">
      <div className="flex shrink-0 items-center gap-2">
        <Mini src={row.left_thumb} ring={pickedLeft} />
        <span className="shrink-0 text-[10px] text-white/28">{t("common.vs")}</span>
        <Mini src={row.right_thumb} ring={!pickedLeft} />
      </div>
      <div className="flex min-w-0 w-full flex-1 items-start justify-between gap-2 sm:items-baseline">
        <span className="min-w-0 flex-1 whitespace-normal break-words text-[11px] leading-snug text-white/65" title={text}>
          {text}
        </span>
        <time className="shrink-0 tabular-nums text-[10px] text-white/35">{timeLabel}</time>
      </div>
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
      <Image
        src={publicImageSrc(src)}
        alt=""
        fill
        className="object-cover"
        sizes="32px"
        quality={65}
        loading="lazy"
      />
    </div>
  );
}
