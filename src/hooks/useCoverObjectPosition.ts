"use client";

import { useEffect, useState } from "react";
import { coverFocalToObjectPosition, detectCoverFocalPoint } from "@/lib/cover-focal-detect";

/**
 * 异步计算首页封面的 `object-position`；热点首屏可 `rush` 尽快跑，其余用 idle 降低主线程争用。
 */
export function useCoverObjectPosition(imageSrc: string, options?: { rush?: boolean }): string | undefined {
  const [pos, setPos] = useState<string | undefined>(undefined);
  const rush = Boolean(options?.rush);

  useEffect(() => {
    if (!imageSrc.trim()) return;

    let cancelled = false;

    const run = async () => {
      const focal = await detectCoverFocalPoint(imageSrc);
      if (cancelled || !focal) return;
      setPos(coverFocalToObjectPosition(focal));
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (rush) {
      void run();
    } else if (typeof window.requestIdleCallback !== "undefined") {
      idleId = window.requestIdleCallback(() => void run(), { timeout: 2800 });
    } else {
      timeoutId = setTimeout(() => void run(), 100);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [imageSrc, rush]);

  return pos;
}
