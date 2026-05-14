"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/contexts/LocaleProvider";
import type { listMatchesHome } from "@/server/match-service";
import { cn } from "@/lib/utils";

type Row = Awaited<ReturnType<typeof listMatchesHome>>[number];

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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <h2 className="text-lg font-medium text-white">{t("home.hotLive")}</h2>
          <span className="text-xs text-white/40">{t("home.hotFormula")}</span>
        </div>
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

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">{t("home.byCreatorRegion")}</h2>
        <div className="flex flex-wrap gap-2">
          {regionEntries.slice(0, 16).map(([region]) => (
            <a
              key={region}
              href={`#region-${encodeURIComponent(region)}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur hover:border-cyan-400/30"
            >
              {region === "未知" && locale === "en" ? t("home.unknownRegion") : region}
            </a>
          ))}
        </div>
        {regionEntries.slice(0, 8).map(([region, list]) => (
          <div key={region} id={`region-${encodeURIComponent(region)}`} className="space-y-2">
            <h3 className="text-sm text-white/70">
              {region === "未知" && locale === "en" ? t("home.unknownRegion") : region}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {list
                .sort((a, b) => b.hotScore - a.hotScore)
                .slice(0, 4)
                .map((r) => (
                  <MatchCard key={r.match.id} row={r} compact />
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
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
  const { match, votes24h, activeVoters, hotScore, listingCover } = row;
  const cover = listingCover ?? match.cover_image;
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
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            quality={88}
            className={cn(
              "object-cover opacity-90 transition group-hover:opacity-100",
              /* 裁切锚点略偏上，多数人像/主体会偏中上，减少「只剩胸口或背景」 */
              compact ? "object-[50%_22%]" : "object-[50%_18%]"
            )}
            sizes={
              compact
                ? "64px"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, min(420px, 34vw)"
            }
            priority={Boolean(highlight && !compact)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/35">{t("home.noCover")}</div>
        )}
      </div>
      <div className={cn("min-w-0 flex-1 space-y-1", compact ? "py-1 pr-2" : "p-4")}>
        <div className="truncate font-medium text-white">{match.title}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
          <span>
            {t("home.totalVotes")} {match.vote_count}
          </span>
          <span>
            {t("home.votes24h")} {votes24h}
          </span>
          <span>
            {t("home.active")} {activeVoters}
          </span>
          {highlight ? (
            <span className="text-cyan-300/90">
              {t("home.hotScore")} {hotScore.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-white/35">{match.status}</div>
      </div>
    </Link>
  );
}
