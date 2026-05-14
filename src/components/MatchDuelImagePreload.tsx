"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { ImageRow } from "@/server/match-service";
import { publicImageSrc } from "@/lib/public-image-src";

/** 与对战卡片缩略图层一致，便于命中 `/_next/image` 缓存 */
const PRELOAD_SIZES = "(max-width: 768px) min(48vw, 420px), min(50vw, 520px)";

function thumbEntries(images: ImageRow[]): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  const seen = new Set<string>();

  for (const img of images) {
    const thumbRaw = (img.thumb_url ?? "").trim();
    const fullRaw = (img.image_url ?? "").trim();
    const src = publicImageSrc(thumbRaw || fullRaw);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push({ key: `${img.id}-t`, src });
  }
  return out;
}

/**
 * 进入比赛后先只预拉**整池缩略图**（字节小、解码快），下一对几乎总能秒出糊图。
 * **高清主图**仅由当前左右卡片的 `ProgressiveRemoteImage` 按档位拉取，避免对未见过的图浪费带宽与解码。
 */
export function MatchDuelImagePreload({ pool }: { pool: ImageRow[] }) {
  const thumbs = useMemo(() => thumbEntries(pool), [pool]);

  if (!thumbs.length) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -left-[9999px] top-0 z-0 flex flex-wrap gap-1 opacity-0"
    >
      {thumbs.map((e) => (
        <div key={e.key} className="relative aspect-[4/5] w-[min(400px,48vw)] shrink-0">
          <Image
            src={e.src}
            alt=""
            fill
            sizes={PRELOAD_SIZES}
            quality={52}
            loading="eager"
            fetchPriority="low"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
