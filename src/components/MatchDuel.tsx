"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { ImageRow } from "@/server/match-service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { slug: string; disabled?: boolean };

export function MatchDuel({ slug, disabled }: Props) {
  const [left, setLeft] = useState<ImageRow | null>(null);
  const [right, setRight] = useState<ImageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leftImgReady, setLeftImgReady] = useState(false);
  const [rightImgReady, setRightImgReady] = useState(false);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  const load = useCallback(async () => {
    await Promise.resolve();
    setErr(null);
    setImgLoadFailed(false);
    setLeftImgReady(false);
    setRightImgReady(false);
    const res = await fetch(`/api/matches/${slug}/next-pair`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "无法加载对战");
      setLeft(null);
      setRight(null);
      return;
    }
    const j = await res.json();
    setLeft(j.left);
    setRight(j.right);
  }, [slug]);

  useEffect(() => {
    setLeftImgReady(false);
    setRightImgReady(false);
    setImgLoadFailed(false);
  }, [left?.id, right?.id]);

  useEffect(() => {
    if (!disabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch schedules state updates after network I/O
      void load();
    }
  }, [disabled, load]);

  const vote = async (winner: ImageRow, loser: ImageRow) => {
    if (!left || !right || busy || !leftImgReady || !rightImgReady || imgLoadFailed) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        winnerId: winner.id,
        loserId: loser.id,
        leftId: left.id,
        rightId: right.id,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "投票失败");
      return;
    }
    await load();
  };

  const skip = async () => {
    if (!left || !right || busy || !leftImgReady || !rightImgReady || imgLoadFailed) return;
    setBusy(true);
    setErr(null);
    await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", slug, leftId: left.id, rightId: right.id }),
    });
    setBusy(false);
    await load();
  };

  if (disabled) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60 backdrop-blur">
        比赛未开启或已暂停，暂时不能投票。
      </div>
    );
  }

  if (err && !left) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-red-300/90">{err}</p>
        <Button onClick={() => void load()}>重试</Button>
      </div>
    );
  }

  if (!left || !right) {
    return <div className="animate-pulse text-center text-white/50">正在为你挑两张图…</div>;
  }

  const imagesInteractive = leftImgReady && rightImgReady && !imgLoadFailed;
  const gateBusy = busy || !imagesInteractive;

  return (
    <div className="space-y-4">
      <p className="text-center text-xs leading-relaxed text-white/50 md:text-sm">
        {imgLoadFailed ? (
          <>
            <strong className="text-amber-200/90">有图片未能加载</strong>，请检查网络后重试本对。
          </>
        ) : imagesInteractive ? (
          <>
            下面两张随机配对，<strong className="text-white/75">点一下你更中意的那张</strong> 即完成一票；选不出来可以点底部「跳过」。
          </>
        ) : (
          <>
            <strong className="text-cyan-200/85">图片加载中…</strong> 加载完成后才能投票或跳过，避免盲选。
          </>
        )}
      </p>
      {err ? <p className="text-center text-sm text-amber-200/90">{err}</p> : null}
      {imgLoadFailed ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" className="text-xs" onClick={() => void load()}>
            重新加载本对
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
        <DuelCard
          image={left}
          side="左"
          busy={gateBusy}
          imageReady={leftImgReady}
          onPick={() => void vote(left, right)}
          onImageReady={() => setLeftImgReady(true)}
          onImageError={() => setImgLoadFailed(true)}
        />
        <DuelCard
          image={right}
          side="右"
          busy={gateBusy}
          imageReady={rightImgReady}
          onPick={() => void vote(right, left)}
          onImageReady={() => setRightImgReady(true)}
          onImageError={() => setImgLoadFailed(true)}
        />
      </div>
      <div className="flex justify-center pt-1">
        <Button
          variant="ghost"
          disabled={gateBusy}
          className="text-xs text-white/55"
          onClick={() => void skip()}
        >
          都不好选，跳过这一对
        </Button>
      </div>
    </div>
  );
}

function DuelCard({
  image,
  side,
  onPick,
  busy,
  imageReady,
  onImageReady,
  onImageError,
}: {
  image: ImageRow;
  side: string;
  busy: boolean;
  imageReady: boolean;
  onPick: () => void;
  onImageReady: () => void;
  onImageError: () => void;
}) {
  const src = image.image_url;
  return (
    <motion.button
      type="button"
      disabled={busy}
      onClick={onPick}
      whileTap={busy ? undefined : { scale: 0.985 }}
      className={cn(
        "group relative flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.06] text-left shadow-lg shadow-black/30 backdrop-blur transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/50",
        busy
          ? "cursor-default opacity-55"
          : "hover:border-cyan-400/55 hover:shadow-cyan-900/20 cursor-pointer",
        busy && "pointer-events-none"
      )}
    >
      <div className="absolute left-2.5 top-2.5 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85 backdrop-blur">
        {side}
      </div>
      <div className="relative aspect-[4/5] max-md:aspect-[3/4] w-full bg-black/35">
        {!imageReady ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40">
            <span className="text-[11px] font-medium text-white/55">加载中…</span>
          </div>
        ) : null}
        <Image
          src={src}
          alt=""
          fill
          priority
          fetchPriority="high"
          quality={82}
          className={cn(
            "object-cover transition duration-300",
            !busy && "group-hover:scale-[1.02]",
            !imageReady && "opacity-0"
          )}
          sizes="(max-width:768px) 46vw, 50vw"
          onLoadingComplete={onImageReady}
          onError={onImageError}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
          <span
            className={cn(
              "rounded-full bg-cyan-500/90 px-2 py-1 text-[10px] font-semibold text-slate-950 shadow-md transition duration-200 sm:px-3 sm:text-[11px]",
              imageReady ? "opacity-0 group-hover:opacity-100 max-md:opacity-100 md:opacity-100" : "opacity-0"
            )}
          >
            点这张投票
          </span>
        </div>
      </div>
      <div className="flex items-center border-t border-white/10 bg-black/25 px-3 py-2.5">
        <span className="text-[11px] text-white/45">{imageReady ? "轻触即投" : "请等待上图加载"}</span>
      </div>
    </motion.button>
  );
}
