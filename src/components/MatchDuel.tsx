"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleProvider";
import { friendlyApiError } from "@/lib/i18n/api-errors";
import {
  FETCH_LOAD_TIMEOUT_MS,
  IMAGE_DECODE_STALL_RETRY_MS,
  fetchWithTimeout,
  isAbortError,
} from "@/lib/fetch-with-timeout";
import type { ImageRow } from "@/server/match-service";
import { MatchDuelCurrentPairPreload } from "@/components/MatchDuelCurrentPairPreload";
import { MatchDuelImagePreload } from "@/components/MatchDuelImagePreload";
import { ProgressiveRemoteImage } from "@/components/ProgressiveRemoteImage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { slug: string; disabled?: boolean };

export function MatchDuel({ slug, disabled }: Props) {
  const { t } = useLocale();
  const [left, setLeft] = useState<ImageRow | null>(null);
  const [right, setRight] = useState<ImageRow | null>(null);
  /** 从点选到下一对加载完成（含提交票与拉新 pair） */
  const [voteInFlight, setVoteInFlight] = useState(false);
  /** 用户刚投的那一侧；与 voteInFlight 同时为真时用于胜者/败者差异化 UI */
  const [pickedSide, setPickedSide] = useState<"left" | "right" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** 正在请求 next-pair：禁止操作，但不清空上一对的「已解码」避免闪白 loading */
  const [pairRequestPending, setPairRequestPending] = useState(false);
  /** 本场全部图片，用于后台预加载尚未出场的对局图 */
  const [preloadPool, setPreloadPool] = useState<ImageRow[]>([]);
  const loadGenRef = useRef(0);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    const gen = ++loadGenRef.current;
    setPairRequestPending(true);
    setErr(null);
    try {
      let res: Response;
      try {
        res = await fetchWithTimeout(`/api/matches/${slug}/next-pair`, undefined, FETCH_LOAD_TIMEOUT_MS);
      } catch (e) {
        if (isAbortError(e)) {
          void loadRef.current?.();
          return;
        }
        if (gen !== loadGenRef.current) return;
        setErr(t("duel.loadFail"));
        setPickedSide(null);
        setPreloadPool([]);
        setLeft(null);
        setRight(null);
        return;
      }
      if (gen !== loadGenRef.current) return;
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ? friendlyApiError(String(j.error), t) : t("duel.loadFail"));
        setPickedSide(null);
        setPreloadPool([]);
        setLeft(null);
        setRight(null);
        return;
      }
      const j = (await res.json()) as { left: ImageRow; right: ImageRow; pool?: ImageRow[] };
      if (gen !== loadGenRef.current) return;
      setLeft(j.left);
      setRight(j.right);
      setPreloadPool(Array.isArray(j.pool) && j.pool.length >= 2 ? j.pool : [j.left, j.right]);
    } finally {
      if (gen === loadGenRef.current) {
        setPairRequestPending(false);
      }
    }
  }, [slug, t]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!disabled) {
      queueMicrotask(() => {
        void load();
      });
    }
  }, [disabled, load]);

  const preloadKey = useMemo(() => {
    if (disabled || preloadPool.length < 2) return "";
    return [...preloadPool].map((i) => i.id).sort().join("|");
  }, [disabled, preloadPool]);

  if (disabled) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60 backdrop-blur">
        {t("duel.inactive")}
      </div>
    );
  }

  if (err && !left) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-red-300/90">{err}</p>
        <Button onClick={() => void load()}>{t("duel.retry")}</Button>
      </div>
    );
  }

  if (!left || !right) {
    return <div className="animate-pulse text-center text-white/50">{t("duel.loadingPair")}</div>;
  }

  return (
    <div className="relative space-y-4">
      <MatchDuelCurrentPairPreload key={`cur-${left.id}-${right.id}`} left={left} right={right} />
      {preloadKey ? <MatchDuelImagePreload key={preloadKey} pool={preloadPool} /> : null}
      <MatchDuelPairSurface
        key={`${left.id}-${right.id}`}
        slug={slug}
        left={left}
        right={right}
        voteInFlight={voteInFlight}
        setVoteInFlight={setVoteInFlight}
        pickedSide={pickedSide}
        setPickedSide={setPickedSide}
        pairRequestPending={pairRequestPending}
        load={load}
        err={err}
        setErr={setErr}
      />
    </div>
  );
}

type MatchDuelPairSurfaceProps = {
  slug: string;
  left: ImageRow;
  right: ImageRow;
  voteInFlight: boolean;
  setVoteInFlight: (v: boolean) => void;
  pickedSide: "left" | "right" | null;
  setPickedSide: (v: "left" | "right" | null) => void;
  pairRequestPending: boolean;
  load: () => Promise<void>;
  err: string | null;
  setErr: (v: string | null) => void;
};

function MatchDuelPairSurface({
  slug,
  left,
  right,
  voteInFlight,
  setVoteInFlight,
  pickedSide,
  setPickedSide,
  pairRequestPending,
  load,
  err,
  setErr,
}: MatchDuelPairSurfaceProps) {
  const { t } = useLocale();
  const [leftImgReady, setLeftImgReady] = useState(false);
  const [rightImgReady, setRightImgReady] = useState(false);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  /** 配对已返回但大图长时间未完成解码/拉取时，重新拉一对（须明显长于 API 超时，避免误打断） */
  useEffect(() => {
    if (leftImgReady && rightImgReady) return;
    const id = window.setTimeout(() => {
      void load();
    }, IMAGE_DECODE_STALL_RETRY_MS);
    return () => window.clearTimeout(id);
  }, [left, right, leftImgReady, rightImgReady, load]);

  const vote = async (winner: ImageRow, loser: ImageRow) => {
    if (voteInFlight || !leftImgReady || !rightImgReady || imgLoadFailed) return;
    const side: "left" | "right" = winner.id === left.id ? "left" : "right";
    setPickedSide(side);
    setVoteInFlight(true);
    setErr(null);
    let res: Response;
    try {
      res = await fetchWithTimeout(
        "/api/vote",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            winnerId: winner.id,
            loserId: loser.id,
            leftId: left.id,
            rightId: right.id,
          }),
        },
        FETCH_LOAD_TIMEOUT_MS
      );
    } catch (e) {
      setVoteInFlight(false);
      setPickedSide(null);
      if (isAbortError(e)) {
        setErr(t("duel.requestTimeout"));
        void load();
        return;
      }
      setErr(t("duel.voteFail"));
      return;
    }
    if (!res.ok) {
      setVoteInFlight(false);
      setPickedSide(null);
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("duel.voteFail"));
      return;
    }
    await load();
    setPickedSide(null);
    setVoteInFlight(false);
  };

  const skip = async () => {
    if (voteInFlight || !leftImgReady || !rightImgReady || imgLoadFailed) return;
    setPickedSide(null);
    setVoteInFlight(true);
    setErr(null);
    let res: Response;
    try {
      res = await fetchWithTimeout(
        "/api/vote",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "skip", slug, leftId: left.id, rightId: right.id }),
        },
        FETCH_LOAD_TIMEOUT_MS
      );
    } catch (e) {
      if (isAbortError(e)) setErr(t("duel.requestTimeout"));
      setVoteInFlight(false);
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("duel.voteFail"));
      setVoteInFlight(false);
      return;
    }
    await load();
    setVoteInFlight(false);
  };

  const imagesInteractive = leftImgReady && rightImgReady && !imgLoadFailed;
  const revealPair = imagesInteractive;
  const gateBusy = voteInFlight || pairRequestPending || !imagesInteractive;
  const pickFeedback = Boolean(voteInFlight && pickedSide);
  const leftResult: "none" | "winner" | "loser" = pickFeedback
    ? pickedSide === "left"
      ? "winner"
      : "loser"
    : "none";
  const rightResult: "none" | "winner" | "loser" = pickFeedback
    ? pickedSide === "right"
      ? "winner"
      : "loser"
    : "none";

  return (
    <>
      <p className="text-center text-xs leading-relaxed text-white/50 md:text-sm">
        {imgLoadFailed ? (
          <>
            <strong className="text-amber-200/90">{t("duel.voteHintFailed")}</strong>
            {t("duel.voteHintFailedSub")}
          </>
        ) : pickFeedback ? (
          <span className="text-emerald-200/90">{t("duel.submittingPick")}</span>
        ) : imagesInteractive ? (
          <>
            {t("duel.voteHintReady")}
            <strong className="text-white/75">{t("duel.voteHintReadyStrong")}</strong>
            {t("duel.voteHintReadySub")}
          </>
        ) : (
          <>
            <strong className="text-cyan-200/85">{t("duel.voteHintLoading")}</strong>
            {t("duel.voteHintLoadingSub")}
          </>
        )}
      </p>
      {err ? <p className="text-center text-sm text-amber-200/90">{err}</p> : null}
      {imgLoadFailed ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" className="text-xs" onClick={() => void load()}>
            {t("duel.reloadPair")}
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
        <DuelCard
          key={left.id}
          image={left}
          side={t("duel.left")}
          interactionLocked={gateBusy}
          resultRole={leftResult}
          revealPair={revealPair}
          onPick={() => void vote(left, right)}
          onImageReady={() => setLeftImgReady(true)}
          onImageError={() => setImgLoadFailed(true)}
        />
        <DuelCard
          key={right.id}
          image={right}
          side={t("duel.right")}
          interactionLocked={gateBusy}
          resultRole={rightResult}
          revealPair={revealPair}
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
          {t("duel.skip")}
        </Button>
      </div>
    </>
  );
}

function DuelCard({
  image,
  side,
  onPick,
  interactionLocked,
  resultRole,
  revealPair,
  onImageReady,
  onImageError,
}: {
  image: ImageRow;
  side: string;
  onPick: () => void;
  interactionLocked: boolean;
  resultRole: "none" | "winner" | "loser";
  revealPair: boolean;
  onImageReady: () => void;
  onImageError: () => void;
}) {
  const { t } = useLocale();
  const thumbRaw = (image.thumb_url ?? "").trim();
  const fullRaw = (image.image_url ?? "").trim();
  const thumbLayerRaw = thumbRaw || fullRaw;
  const fullLayerRaw = thumbRaw && fullRaw && thumbRaw !== fullRaw ? fullRaw : null;

  const sizes = "(max-width: 768px) min(48vw, 420px), min(50vw, 520px)";

  const showPick = resultRole !== "none";
  const symmetricDim = interactionLocked && !showPick;

  return (
    <motion.button
      type="button"
      disabled={interactionLocked}
      onClick={onPick}
      whileTap={interactionLocked ? undefined : { scale: 0.985 }}
      className={cn(
        "group relative flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border-2 text-left shadow-lg backdrop-blur transition-[transform,opacity,filter,border-color,box-shadow,background-color] duration-300 ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/50",
        !showPick && "border-white/10 bg-white/[0.06] shadow-black/30",
        symmetricDim && "pointer-events-none cursor-default border-white/10 bg-white/[0.05] opacity-[0.52] shadow-black/25",
        showPick &&
          resultRole === "winner" &&
          "pointer-events-none z-[2] scale-[1.015] cursor-default border-emerald-400/80 bg-emerald-950/25 shadow-emerald-950/40 ring-2 ring-emerald-400/40",
        showPick &&
          resultRole === "loser" &&
          "pointer-events-none z-0 scale-[0.985] cursor-default border-white/[0.07] bg-black/45 opacity-[0.44] shadow-black/50 grayscale",
        !interactionLocked &&
          "cursor-pointer hover:border-cyan-400/55 hover:bg-white/[0.08] hover:shadow-cyan-900/25"
      )}
    >
      <div
        className={cn(
          "absolute left-2.5 top-2.5 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85 backdrop-blur",
          showPick && resultRole === "loser" && "opacity-45"
        )}
      >
        {side}
      </div>
      {showPick && resultRole === "winner" ? (
        <div className="absolute right-2 top-2.5 z-[11] flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950 shadow-md shadow-emerald-900/30">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-950 text-[9px] text-emerald-300">
            ✓
          </span>
          {t("duel.pickedRibbon")}
        </div>
      ) : showPick && resultRole === "loser" ? (
        <div className="absolute right-2 top-2.5 z-[11] rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/45 backdrop-blur">
          {t("duel.otherRibbon")}
        </div>
      ) : null}
      <div className="relative aspect-[4/5] max-md:aspect-[3/4] w-full bg-black/35">
        {!revealPair ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40">
            <span className="text-[11px] font-medium text-white/55">{t("duel.loadingImg")}</span>
          </div>
        ) : null}

        <ProgressiveRemoteImage
          thumbUrlRaw={thumbLayerRaw}
          fullUrlRaw={fullLayerRaw}
          resetKey={image.id}
          sizes={sizes}
          priority
          fetchPriority="high"
          duelTiming
          visible={revealPair}
          imageClassName={cn(
            revealPair && !interactionLocked && "group-hover:scale-[1.02]",
            showPick && resultRole === "loser" && "brightness-[0.88] contrast-[0.92]"
          )}
          onThumbLoadingComplete={onImageReady}
          onThumbError={onImageError}
        />

        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90 transition-opacity duration-300",
            !revealPair && "opacity-0",
            showPick && resultRole === "loser" && "from-black/85 via-black/25 to-black/20 opacity-100"
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
          {!showPick ? (
            <span
              className={cn(
                "rounded-full bg-cyan-500/90 px-2 py-1 text-[10px] font-semibold text-slate-950 shadow-md transition duration-200 sm:px-3 sm:text-[11px]",
                revealPair ? "opacity-0 group-hover:opacity-100 max-md:opacity-100 md:opacity-100" : "opacity-0"
              )}
            >
              {t("duel.tapToVote")}
            </span>
          ) : resultRole === "winner" ? (
            <span className="rounded-full bg-emerald-400/95 px-2.5 py-1 text-[10px] font-bold text-emerald-950 shadow-md sm:px-3 sm:text-[11px]">
              ✓
            </span>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "flex items-center border-t px-3 py-2.5 transition-colors duration-300",
          !showPick && "border-white/10 bg-black/25",
          showPick && resultRole === "winner" && "border-emerald-400/40 bg-emerald-950/40",
          showPick && resultRole === "loser" && "border-white/[0.06] bg-black/35"
        )}
      >
        <span
          className={cn(
            "text-[11px] transition-colors duration-300",
            !showPick && "text-white/45",
            showPick && resultRole === "winner" && "font-medium text-emerald-100/95",
            showPick && resultRole === "loser" && "text-white/38"
          )}
        >
          {showPick && resultRole === "winner"
            ? t("duel.footerWinner")
            : showPick && resultRole === "loser"
              ? t("duel.footerLoser")
              : revealPair
                ? t("duel.tapReady")
                : t("duel.tapWait")}
        </span>
      </div>
    </motion.button>
  );
}
