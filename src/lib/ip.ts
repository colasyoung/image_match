import { createHash } from "crypto";

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

export function regionFromHeaders(headers: Headers): string {
  const country = headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry");
  const city = headers.get("x-vercel-ip-city");
  if (country && city) return `${country}｜${city}`;
  if (country) return country;
  return "未知";
}
