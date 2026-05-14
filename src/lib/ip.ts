import { createHash } from "crypto";
import { CN_MUNICIPALITY_ZH, cnIso31662CodeToZh, normalizeChinaRegionCode } from "@/lib/cn-region-iso";

export function hashIp(raw: string | null): string {
  const normalized = (raw ?? "").split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(normalized).digest("hex");
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded;
  const real = headers.get("x-real-ip");
  if (real) return real;
  return null;
}

function headerOne(headers: Headers, names: readonly string[]): string | null {
  for (const n of names) {
    const v = headers.get(n)?.trim();
    if (v) return v;
  }
  return null;
}

/**
 * 从边缘请求头解析「地区」展示串。
 * - 中国（当前主部署在 Vercel）：用 `x-vercel-ip-country-region`（ISO 3166-2 子码）映射到省/自治区/直辖市，城市用 `x-vercel-ip-city`。
 * - 非中国：保持「国家｜城市」。
 * - 若将来请求经过 Cloudflare 且带有 `cf-region-code` / `cf-region` / `cf-ipcity`，也会参与解析（与 Vercel 头二选一由 `headerOne` 顺序决定）。
 */
export function regionFromHeaders(headers: Headers): string {
  const countryRaw = headerOne(headers, ["x-vercel-ip-country", "cf-ipcountry"]);
  const country = countryRaw ? countryRaw.toUpperCase() : "";

  const city = headerOne(headers, ["x-vercel-ip-city", "cf-ipcity"]);
  const regionCodeRaw = headerOne(headers, ["x-vercel-ip-country-region", "cf-region-code"]);
  const cfRegionLabel = headerOne(headers, ["cf-region"]);

  if (country === "CN") {
    const sub = normalizeChinaRegionCode(regionCodeRaw);
    const fromIso = sub ? cnIso31662CodeToZh(sub) : null;
    const fromCfCjk =
      !fromIso && cfRegionLabel && /[\u4e00-\u9fff]/.test(cfRegionLabel) ? cfRegionLabel : null;
    const provinceZh = fromIso ?? fromCfCjk;

    if (provinceZh) {
      if (city && !CN_MUNICIPALITY_ZH.has(provinceZh)) {
        return `中国｜${provinceZh}｜${city}`;
      }
      return `中国｜${provinceZh}`;
    }
    if (city) return `中国｜${city}`;
    return "中国";
  }

  if (country && city) return `${country}｜${city}`;
  if (country) return country;
  return "未知";
}
