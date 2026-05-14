"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { ImageRow } from "@/server/match-service";
import { publicImageSrc } from "@/lib/public-image-src";

const SIZES = "(max-width: 768px) min(48vw, 420px), min(50vw, 520px)";

type Slot = { key: string; src: string; quality: number; role: "thumb" | "full" };

function slotsForImage(img: ImageRow): Slot[] {
  const thumbRaw = (img.thumb_url ?? "").trim();
  const fullRaw = (img.image_url ?? "").trim();
  const thumbLayer = thumbRaw || fullRaw;
  const fullLayer = thumbRaw && fullRaw && thumbRaw !== fullRaw ? fullRaw : null;
  const out: Slot[] = [];
  const t = publicImageSrc(thumbLayer);
  if (t) out.push({ key: `${img.id}-cur-t`, src: t, quality: 52, role: "thumb" });
  if (fullLayer) {
    const f = publicImageSrc(fullLayer);
    if (f && f !== t) out.push({ key: `${img.id}-cur-f`, src: f, quality: 78, role: "full" });
  }
  return out;
}

/**
 * 当前左右一对：与主卡片并行预填缓存。
 * 缩略图：`priority` + `fetchPriority=high`，换对后尽快出清 thumb。
 * 高清：仅 eager + 较低 fetch priority，避免抢在「当前缩略图 / 整池 thumb 阶段」之前；已进缓存时主卡片会直接叠高清。
 */
export function MatchDuelCurrentPairPreload({ left, right }: { left: ImageRow; right: ImageRow }) {
  const entries = useMemo(() => [...slotsForImage(left), ...slotsForImage(right)], [left, right]);

  if (!entries.length) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed -left-[9999px] top-0 z-0 flex flex-wrap gap-1 opacity-0"
    >
      {entries.map((e) => (
        <div key={e.key} className="relative aspect-[4/5] w-[min(400px,48vw)] shrink-0">
          <Image
            src={e.src}
            alt=""
            fill
            sizes={SIZES}
            quality={e.quality}
            priority={e.role === "thumb"}
            loading="eager"
            fetchPriority={e.role === "thumb" ? "high" : "low"}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
