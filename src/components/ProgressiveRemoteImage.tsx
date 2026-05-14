"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNetworkImageTier } from "@/hooks/useNetworkImageTier";
import { fullImageUpgradeDelayMs } from "@/lib/image-network-tier";
import type { ImageNetworkTier } from "@/lib/image-network-tier";
import { publicImageSrc } from "@/lib/public-image-src";
import { cn } from "@/lib/utils";

type Props = {
  /** 先显示的 URL（通常为缩略图；无缩略图时可传主图 URL） */
  thumbUrlRaw: string;
  /** 与 thumb 不同时再拉高清层；不传或与 thumb 相同则单层 */
  fullUrlRaw?: string | null;
  sizes: string;
  qualityThumb?: number;
  qualityFull?: number;
  qualitySingle?: number;
  priority?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
  /** false 时图层 opacity-0（仍可解码，如对战未揭开） */
  visible?: boolean;
  imageClassName?: string;
  onThumbLoadingComplete?: () => void;
  onThumbError?: () => void;
  /** 传给底层 `img` 的 `object-position`（例如首页智能裁切锚点） */
  objectPosition?: string;
  /** 对战页：缩略图就绪后立即请求高清层（无档位等待）；首页等仍按档位延迟 */
  duelTiming?: boolean;
  /** 换图时重置内部状态 */
  resetKey?: string;
};

type LayersProps = Omit<Props, "thumbUrlRaw" | "fullUrlRaw" | "resetKey"> & {
  tier: ImageNetworkTier;
  thumbSrc: string;
  fullSrc: string;
  progressive: boolean;
};

function ProgressiveRemoteImageLayers({
  thumbSrc,
  fullSrc,
  progressive,
  tier,
  sizes,
  qualityThumb = 52,
  qualityFull = 78,
  qualitySingle = 72,
  priority = false,
  fetchPriority = "auto",
  loading,
  visible = true,
  imageClassName,
  objectPosition,
  onThumbLoadingComplete,
  onThumbError,
  duelTiming = false,
}: LayersProps) {
  const [thumbDecoded, setThumbDecoded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  /** 高清层拉取失败：不再叠透明层，缩略图保持清晰可用 */
  const [fullFailed, setFullFailed] = useState(false);

  const thumbRef = useRef<HTMLImageElement | null>(null);
  const singleRef = useRef<HTMLImageElement | null>(null);
  const thumbReadyFired = useRef(false);
  const singleReadyFired = useRef(false);

  const fireThumbReady = useCallback(() => {
    if (thumbReadyFired.current) return;
    thumbReadyFired.current = true;
    setThumbDecoded(true);
    if (duelTiming && progressive) {
      setShowFull(true);
    }
    onThumbLoadingComplete?.();
  }, [duelTiming, progressive, onThumbLoadingComplete]);

  const fireSingleReady = useCallback(() => {
    if (singleReadyFired.current) return;
    singleReadyFired.current = true;
    onThumbLoadingComplete?.();
  }, [onThumbLoadingComplete]);

  useLayoutEffect(() => {
    thumbReadyFired.current = false;
    singleReadyFired.current = false;
    if (progressive) {
      const el = thumbRef.current;
      if (el?.complete && el.naturalWidth > 1) {
        queueMicrotask(() => fireThumbReady());
      }
    } else {
      const el = singleRef.current;
      if (el?.complete && el.naturalWidth > 1) {
        queueMicrotask(() => fireSingleReady());
      }
    }
  }, [progressive, thumbSrc, fullSrc, fireThumbReady, fireSingleReady]);

  useEffect(() => {
    if (!progressive || !thumbDecoded) return;
    if (duelTiming) return;
    const delay = fullImageUpgradeDelayMs(tier);
    if (delay === 0) {
      queueMicrotask(() => setShowFull(true));
      return;
    }
    const id = window.setTimeout(() => setShowFull(true), delay);
    return () => clearTimeout(id);
  }, [progressive, thumbDecoded, tier, thumbSrc, fullSrc, duelTiming]);

  const vis = visible ? "opacity-100" : "opacity-0";
  const posStyle = objectPosition ? ({ objectPosition } as const) : undefined;

  if (!progressive) {
    return (
      <Image
        ref={singleRef}
        src={thumbSrc}
        alt=""
        fill
        priority={priority}
        fetchPriority={fetchPriority}
        quality={qualitySingle}
        sizes={sizes}
        loading={loading}
        style={posStyle}
        className={cn("object-cover transition duration-300", vis, imageClassName)}
        onLoadingComplete={fireSingleReady}
        onError={onThumbError}
      />
    );
  }

  return (
    <>
      <Image
        ref={thumbRef}
        src={thumbSrc}
        alt=""
        fill
        priority={priority}
        fetchPriority={fetchPriority}
        quality={qualityThumb}
        sizes={sizes}
        loading={loading}
        style={posStyle}
        className={cn(
          "object-cover transition duration-300",
          vis,
          /* 对战：宁可先清晰缩略图，不因等高清而糊脸 */
          showFull && !fullLoaded && !duelTiming && "max-md:blur-[2px]",
          imageClassName
        )}
        onLoadingComplete={fireThumbReady}
        onError={onThumbError}
      />
      {showFull && !fullFailed ? (
        <Image
          key={fullSrc}
          src={fullSrc}
          alt=""
          fill
          priority={false}
          fetchPriority={duelTiming ? "high" : "low"}
          quality={qualityFull}
          sizes={sizes}
          style={posStyle}
          className={cn(
            "pointer-events-none absolute inset-0 z-[2] object-cover transition-opacity duration-500 ease-out",
            fullLoaded ? "opacity-100" : "opacity-0",
            vis
          )}
          onLoadingComplete={() => setFullLoaded(true)}
          onError={() => setFullFailed(true)}
        />
      ) : null}
    </>
  );
}

/**
 * 先解码轻图再叠高清。首页等：`duelTiming` 关闭时按网络档位延迟拉主图。
 * 对战：`duelTiming` 开启时缩略图一就绪就立刻请求高清；并已缓存的缩略图会立刻 `onThumbLoadingComplete`，减少「下一对」白屏。
 */
export function ProgressiveRemoteImage({
  thumbUrlRaw,
  fullUrlRaw,
  resetKey = "",
  ...rest
}: Props) {
  const tier = useNetworkImageTier();
  const thumbSrc = publicImageSrc(thumbUrlRaw.trim());
  const fullTrim = (fullUrlRaw ?? "").trim();
  const fullSrc = fullTrim ? publicImageSrc(fullTrim) : "";
  const progressive = Boolean(thumbSrc && fullSrc && thumbSrc !== fullSrc);

  if (!thumbSrc) return null;

  return (
    <ProgressiveRemoteImageLayers
      key={`${resetKey}|${thumbSrc}|${fullSrc}`}
      tier={tier}
      thumbSrc={thumbSrc}
      fullSrc={fullSrc}
      progressive={progressive}
      {...rest}
    />
  );
}
