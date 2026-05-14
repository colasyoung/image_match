"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageRow } from "@/server/match-service";
import { publicImageSrc } from "@/lib/public-image-src";

/** 与对战卡片一致，便于 `/_next/image` 缓存与 ProgressiveRemoteImage 对齐 */
const PRELOAD_SIZES = "(max-width: 768px) min(48vw, 420px), min(50vw, 520px)";

/**
 * 缩略图阶段最长等待：尽量等齐整池缩略图后再开高清，避免与「先铺满缩略图」目标冲突；
 * 超时后仍进入高清阶段，避免单张坏链永久卡住。
 */
const THUMB_PHASE_MAX_MS = 12_000;
/** 缩略图阶段结束 → 开高清：idle 兜底超时（毫秒） */
const FULL_IDLE_TIMEOUT_MS = 320;
/** 每批挂载的高清预加载数量，避免与当前对局抢满连接 */
const FULL_BATCH = 2;
/** 批次间隔（毫秒） */
const FULL_BATCH_GAP_MS = 44;

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

function fullEntries(images: ImageRow[]): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  const seen = new Set<string>();

  for (const img of images) {
    const thumbRaw = (img.thumb_url ?? "").trim();
    const fullRaw = (img.image_url ?? "").trim();
    const thumbSrc = publicImageSrc(thumbRaw || fullRaw);
    const fullSrc = publicImageSrc(fullRaw);
    if (!fullSrc || !thumbSrc || fullSrc === thumbSrc || seen.has(fullSrc)) continue;
    seen.add(fullSrc);
    out.push({ key: `${img.id}-f`, src: fullSrc });
  }
  return out;
}

/**
 * 单场比赛池：`key` 变化即重挂，阶段状态清零，无需在 effect 里同步 reset。
 * 1. 先并行整池缩略图（全部 onLoad / onError 或超时后再进入高清，避免与「先铺满缩略图」抢带宽）。
 * 2. 再进入高清阶段：idle/短超时后分批挂载高清 `Image`，持续填满缓存；主界面卡片仍走 ProgressiveRemoteImage（有缓存则直接叠高清）。
 */
function MatchDuelImagePreloadInner({ pool }: { pool: ImageRow[] }) {
  const [phaseFull, setPhaseFull] = useState(false);
  const [visibleFullCount, setVisibleFullCount] = useState(0);
  const [thumbsDoneCount, setThumbsDoneCount] = useState(0);
  const [thumbPhaseTimedOut, setThumbPhaseTimedOut] = useState(false);
  const thumbDoneKeysRef = useRef(new Set<string>());

  const thumbs = useMemo(() => thumbEntries(pool), [pool]);
  const allFulls = useMemo(() => fullEntries(pool), [pool]);
  const nThumbs = thumbs.length;

  const markThumbDone = useCallback((key: string) => {
    if (thumbDoneKeysRef.current.has(key)) return;
    thumbDoneKeysRef.current.add(key);
    setThumbsDoneCount(thumbDoneKeysRef.current.size);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setThumbPhaseTimedOut(true), THUMB_PHASE_MAX_MS);
    return () => window.clearTimeout(id);
  }, []);

  const thumbGateOpen = nThumbs === 0 || thumbsDoneCount >= nThumbs || thumbPhaseTimedOut;

  useEffect(() => {
    if (!thumbGateOpen) return;
    let idleId: number | undefined;
    let fallbackId = 0;
    const kick = () => setPhaseFull(true);
    if (typeof window.requestIdleCallback !== "undefined") {
      idleId = window.requestIdleCallback(kick, { timeout: FULL_IDLE_TIMEOUT_MS });
    } else {
      fallbackId = window.setTimeout(kick, 48);
    }
    return () => {
      window.clearTimeout(fallbackId);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
    };
  }, [thumbGateOpen]);

  useEffect(() => {
    if (!phaseFull) return;
    const n = allFulls.length;
    if (n === 0 || visibleFullCount >= n) return;
    const id = window.setTimeout(() => {
      setVisibleFullCount((c) => Math.min(c + FULL_BATCH, n));
    }, FULL_BATCH_GAP_MS);
    return () => window.clearTimeout(id);
  }, [phaseFull, visibleFullCount, allFulls.length]);

  const fullSlice = allFulls.slice(0, visibleFullCount);

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
            fetchPriority="high"
            className="object-cover"
            onLoadingComplete={() => markThumbDone(e.key)}
            onError={() => markThumbDone(e.key)}
          />
        </div>
      ))}
      {fullSlice.map((e) => (
        <div key={e.key} className="relative aspect-[4/5] w-[min(400px,48vw)] shrink-0">
          <Image
            src={e.src}
            alt=""
            fill
            sizes={PRELOAD_SIZES}
            quality={78}
            loading="eager"
            fetchPriority="low"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export function MatchDuelImagePreload({ pool }: { pool: ImageRow[] }) {
  const poolKey = useMemo(() => [...pool].map((i) => i.id).sort().join(","), [pool]);
  const hasThumbs = useMemo(() => thumbEntries(pool).length > 0, [pool]);
  if (!hasThumbs) return null;
  return <MatchDuelImagePreloadInner key={poolKey} pool={pool} />;
}
