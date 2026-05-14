"use client";

import Link from "next/link";
import { ProgressiveRemoteImage } from "@/components/ProgressiveRemoteImage";
import { useLocale } from "@/contexts/LocaleProvider";
import { useCoverObjectPosition } from "@/hooks/useCoverObjectPosition";
import { HOME_MAX_CREATOR_REGIONS, HOME_MAX_MATCHES_PER_REGION } from "@/lib/home-creator-regions";
import { formatRegionHeatLabel } from "@/lib/region-display";
import type { listMatchesHome } from "@/server/match-service";
import { matchStatusDisplay } from "@/lib/match-status-label";
import { publicImageSrc } from "@/lib/public-image-src";
import { cn } from "@/lib/utils";

type Row = Awaited<ReturnType<typeof listMatchesHome>>[number];

const MAX_CREATOR_REGIONS = HOME_MAX_CREATOR_REGIONS;
const MAX_MATCHES_PER_REGION = HOME_MAX_MATCHES_PER_REGION;

export function HomeView({
  hot,
  latest,
  regionEntries,
  homeError,
}: {
  hot: Row[];
  latest: Row[];
  regionEntries: [string, Row[]][];
  homeError: string | null;
}) {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10">
      {homeError ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-50">
          <p className="font-medium text-amber-100">{t("home.errorDbTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{homeError}</p>
          <p className="mt-2 text-xs text-amber-100/70">{t("home.errorDbHint")}</p>
        </div>
      ) : null}
      <header className="space-y-4 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/80">Image Match</p>
        <h1 className="text-balance text-4xl font-semibold text-white md:text-5xl">{t("home.titleTagline")}</h1>
        <p className="max-w-2xl text-pretty text-white/60">{t("home.heroSub")}</p>
        <div className="flex flex-wrap justify-center gap-3 md:justify-start">
          <Link
            href="/create"
            className="rounded-xl bg-cyan-400/90 px-5 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
          >
            {t("home.createMatch")}
          </Link>
          <Link
            href="#hot"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/85 backdrop-blur transition hover:bg-white/10"
          >
            {t("home.hotList")}
          </Link>
        </div>
      </header>

      <section id="hot" className="space-y-4">
        <h2 className="text-lg font-medium text-white">{t("home.hotLive")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hot.map((r) => (
            <MatchCard key={r.match.id} row={r} highlight />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">{t("home.latest")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((r) => (
            <MatchCard key={r.match.id} row={r} />
          ))}
        </div>
      </section>

      <section id="by-region" className="space-y-4 scroll-mt-20">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-white">{t("home.byCreatorRegion")}</h2>
          <p className="max-w-2xl text-pretty text-xs leading-relaxed text-white/45">{t("home.byCreatorRegionHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {regionEntries.slice(0, MAX_CREATOR_REGIONS).map(([region, list]) => {
            const label = formatRegionHeatLabel(region, locale);
            return (
              <a
                key={region}
                href={`#region-${encodeURIComponent(region)}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-2.5 text-xs text-white/75 backdrop-blur transition hover:border-cyan-400/35 hover:text-white/90"
              >
                <span className="min-w-0 truncate">{label}</span>
                <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/55">
                  {list.length}
                </span>
              </a>
            );
          })}
        </div>
        {regionEntries.slice(0, MAX_CREATOR_REGIONS).map(([region, list]) => {
          const label = formatRegionHeatLabel(region, locale);
          return (
            <div
              key={region}
              id={`region-${encodeURIComponent(region)}`}
              className="scroll-mt-24 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
                <h3 className="text-sm font-medium text-white/90">{label}</h3>
                <span className="text-xs tabular-nums text-white/40">{t("home.regionMatchCount", { n: list.length })}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list
                  .sort((a, b) => b.hotScore - a.hotScore)
                  .slice(0, MAX_MATCHES_PER_REGION)
                  .map((r) => (
                    <MatchCard key={r.match.id} row={r} compact />
                  ))}
              </div>
            </div>
          );
        })}
        {regionEntries.length > MAX_CREATOR_REGIONS ? (
          <p className="text-xs leading-relaxed text-white/40">
            {t("home.moreRegionsNote", { n: regionEntries.length - MAX_CREATOR_REGIONS })}
          </p>
        ) : null}
      </section>
    </div>
  );
}

/** 封面 URL 或比赛变化时通过 `key` 重置智能裁切状态，避免沿用上一条 `object-position`。 */
function HomeListingCoverImage({
  matchId,
  thumbUrlRaw,
  listingCoverFull,
  compact,
  highlight,
}: {
  matchId: string;
  thumbUrlRaw: string;
  listingCoverFull: string | null;
  compact: boolean;
  highlight: boolean;
}) {
  const focalSrc = publicImageSrc(thumbUrlRaw);
  const smartObjectPosition = useCoverObjectPosition(focalSrc, {
    rush: Boolean(highlight && !compact),
  });

  return (
    <ProgressiveRemoteImage
      thumbUrlRaw={thumbUrlRaw}
      fullUrlRaw={listingCoverFull}
      resetKey={matchId}
      objectPosition={smartObjectPosition}
      sizes={
        compact ? "64px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, min(420px, 34vw)"
      }
      priority={Boolean(highlight && !compact)}
      fetchPriority={highlight && !compact ? "high" : "auto"}
      loading={highlight && !compact ? "eager" : "lazy"}
      imageClassName={cn(
        "opacity-90 transition-opacity duration-300 group-hover:opacity-100 ease-out [transition-property:object-position,opacity] [transition-duration:500ms,300ms]",
        !smartObjectPosition && (compact ? "object-[50%_22%]" : "object-[50%_18%]")
      )}
    />
  );
}

function MatchCard({
  row,
  highlight,
  compact,
}: {
  row: Row;
  highlight?: boolean;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const { match, votes24h, activeVoters, hotScore, listingCover, listingCoverFull } = row;
  const thumbUrlRaw = (listingCover ?? match.cover_image ?? "").trim();
  const coverKey = `${match.id}|${publicImageSrc(thumbUrlRaw)}`;
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
        {thumbUrlRaw ? (
          <HomeListingCoverImage
            key={coverKey}
            matchId={match.id}
            thumbUrlRaw={thumbUrlRaw}
            listingCoverFull={listingCoverFull}
            compact={Boolean(compact)}
            highlight={Boolean(highlight)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/35">{t("home.noCover")}</div>
        )}
      </div>
      <div className={cn("min-w-0 flex-1 space-y-1", compact ? "py-1 pr-2" : "p-4")}>
        <div className="truncate font-medium text-white">{match.title}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
          <span>{t("home.totalVotesLine", { n: match.vote_count })}</span>
          <span>{t("home.votes24hLine", { n: votes24h })}</span>
          <span>{t("home.activeVotersLine", { n: activeVoters })}</span>
          {highlight ? (
            <span className="text-cyan-300/90">
              {t("home.hotScore")} {hotScore.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="text-[11px] text-white/35">{matchStatusDisplay(t, match.status)}</div>
      </div>
    </Link>
  );
}
