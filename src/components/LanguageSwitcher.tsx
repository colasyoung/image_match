"use client";

import { useLocale } from "@/contexts/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/types";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  const pill = (code: AppLocale, label: string) => (
    <button
      type="button"
      onClick={() => setLocale(code)}
      className={
        locale === code
          ? "rounded-md bg-cyan-400/25 px-2 py-1 text-xs font-semibold text-cyan-50"
          : "rounded-md px-2 py-1 text-xs font-medium text-white/55 transition hover:bg-white/10 hover:text-white/80"
      }
      aria-pressed={locale === code}
      aria-label={label}
    >
      {code === "zh" ? t("nav.langZh") : t("nav.langEn")}
    </button>
  );

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/25 p-0.5"
      role="group"
      aria-label={t("nav.langAria")}
    >
      {pill("zh", t("nav.langZh"))}
      {pill("en", t("nav.langEn"))}
    </div>
  );
}
