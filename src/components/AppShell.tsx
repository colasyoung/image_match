"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocaleProvider, useLocale } from "@/contexts/LocaleProvider";
import {
  AUTHOR_FACEBOOK_URL,
  AUTHOR_INSTAGRAM_URL,
} from "@/lib/author-links";
import type { AppLocale } from "@/lib/i18n/types";

function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="relative z-10 border-t border-white/5 bg-black/15 px-4 py-5 text-center text-[10px] leading-relaxed text-white/38">
      <p className="mx-auto max-w-3xl">{t("site.complianceFoot")}</p>
      <div className="mx-auto mt-4 max-w-3xl border-t border-white/10 pt-4 text-white/48">
        <p>{t("site.authorIntro")}</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
          <a
            href={AUTHOR_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-1.5 py-0.5 text-cyan-300/85 underline decoration-cyan-400/35 underline-offset-2 transition hover:text-cyan-200 hover:decoration-cyan-300/60"
            aria-label={t("site.authorAriaFacebook")}
          >
            {t("site.authorLinkFacebook")}
          </a>
          <span className="text-white/25" aria-hidden>
            ·
          </span>
          <a
            href={AUTHOR_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-1.5 py-0.5 text-cyan-300/85 underline decoration-cyan-400/35 underline-offset-2 transition hover:text-cyan-200 hover:decoration-cyan-300/60"
            aria-label={t("site.authorAriaInstagram")}
          >
            {t("site.authorLinkInstagram")}
          </a>
        </p>
      </div>
    </footer>
  );
}

function TopNavInner() {
  const { t } = useLocale();
  return (
    <nav className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-sm font-medium tracking-wide text-white/90">
          Image Match
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/create"
            className="rounded-lg bg-cyan-400/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-300"
          >
            {t("nav.create")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function AppShell({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  return (
    <LocaleProvider key={initialLocale} initialLocale={initialLocale}>
      <div className="flex min-h-full flex-col">
        <TopNavInner />
        <main className="relative z-10 flex-1">{children}</main>
        <SiteFooter />
      </div>
    </LocaleProvider>
  );
}
