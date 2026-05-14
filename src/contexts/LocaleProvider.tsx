"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { interpolate } from "@/lib/i18n/interpolate";
import { MESSAGES } from "@/lib/i18n/messages";
import type { AppLocale } from "@/lib/i18n/types";
import { LOCALE_COOKIE } from "@/lib/i18n/types";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (path: string, vars?: Record<string, string | number | undefined>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback(
    (next: AppLocale) => {
      const secure =
        typeof window !== "undefined" && window.location.protocol === "https:"
          ? ";Secure"
          : "";
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax${secure}`;
      setLocaleState(next);
      router.refresh();
    },
    [router]
  );

  const t = useCallback(
    (path: string, vars?: Record<string, string | number | undefined>) => {
      const raw = deepGet(MESSAGES[locale], path);
      const template = typeof raw === "string" ? raw : path;
      return interpolate(template, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
