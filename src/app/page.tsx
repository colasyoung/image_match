import { HomeView } from "@/app/HomeView";
import { translateStatic } from "@/lib/i18n/translate-static";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { listMatchesHome } from "@/server/match-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getServerLocale();
  let rows: Awaited<ReturnType<typeof listMatchesHome>> = [];
  let homeError: string | null = null;
  try {
    rows = await listMatchesHome();
  } catch (e) {
    const detail = e instanceof Error ? e.message : translateStatic(locale, "home.errorUnknown");
    homeError = translateStatic(locale, "home.errorFallback", { detail });
  }

  const hot = [...rows].sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
  const latest = [...rows].sort(
    (a, b) => new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime()
  ).slice(0, 12);
  const regions = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.match.created_ip_region ?? "未知";
    if (!regions.has(k)) regions.set(k, []);
    regions.get(k)!.push(r);
  }
  const regionEntries = [...regions.entries()];

  return (
    <HomeView hot={hot} latest={latest} regionEntries={regionEntries} homeError={homeError} />
  );
}
