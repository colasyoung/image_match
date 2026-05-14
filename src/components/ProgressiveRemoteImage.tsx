"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
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
}: LayersProps) {
  const [thumbDecoded, setThumbDecoded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);

  const onThumbComplete = useCallback(() => {
    setThumbDecoded(true);
    onThumbLoadingComplete?.();
  }, [onThumbLoadingComplete]);

  useEffect(() => {
    if (!progressive || !thumbDecoded) return;
    const delay = fullImageUpgradeDelayMs(tier);
    if (delay === 0) {
      queueMicrotask(() => setShowFull(true));
      return;
    }
    const id = window.setTimeout(() => setShowFull(true), delay);
    return () => clearTimeout(id);
  }, [progressive, thumbDecoded, tier, thumbSrc, fullSrc]);

  const vis = visible ? "opacity-100" : "opacity-0";
  const posStyle = objectPosition ? ({ objectPosition } as const) : undefined;

  if (!progressive) {
    return (
      <Image
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
        onLoadingComplete={onThumbLoadingComplete}
        onError={onThumbError}
      />
    );
  }

  return (
    <>
      <Image
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
          showFull && !fullLoaded && "max-md:blur-[2px]",
          imageClassName
        )}
        onLoadingComplete={onThumbComplete}
        onError={onThumbError}
      />
      {showFull ? (
        <Image
          key={fullSrc}
          src={fullSrc}
          alt=""
          fill
          priority={false}
          fetchPriority="low"
          quality={qualityFull}
          sizes={sizes}
          style={posStyle}
          className={cn(
            "pointer-events-none absolute inset-0 z-[2] object-cover transition-opacity duration-500 ease-out",
            fullLoaded ? "opacity-100" : "opacity-0",
            vis
          )}
          onLoadingComplete={() => setFullLoaded(true)}
          onError={() => {
            /* 保留缩略图 */
          }}
        />
      ) : null}
    </>
  );
}

/**
 * 与对战页一致：先解码轻图，再按 `navigator.connection` 档位延迟拉高清并淡入。
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
