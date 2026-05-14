import { interpolate } from "@/lib/i18n/interpolate";
import { MESSAGES } from "@/lib/i18n/messages";
import type { AppLocale } from "@/lib/i18n/types";

export function translateStatic(
  locale: AppLocale,
  path: string,
  vars?: Record<string, string | number | undefined>
): string {
  const raw = path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, MESSAGES[locale] as unknown);
  const template = typeof raw === "string" ? raw : path;
  return interpolate(template, vars);
}
