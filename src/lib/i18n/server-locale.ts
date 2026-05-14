import { cookies, headers } from "next/headers";
import type { AppLocale } from "./types";
import { LOCALE_COOKIE } from "./types";

/** 根据 Accept-Language 推断界面语言：任意 zh* 为中文，否则英文 */
export function localeFromAcceptLanguage(accept: string | null): AppLocale {
  if (!accept?.trim()) return "en";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase() ?? "";
    if (code.startsWith("zh")) return "zh";
  }
  return "en";
}

/** 优先 Cookie（用户手动选择），否则按浏览器语言推断 */
export async function getServerLocale(): Promise<AppLocale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  if (raw === "zh" || raw === "en") return raw;
  const h = await headers();
  return localeFromAcceptLanguage(h.get("accept-language"));
}
