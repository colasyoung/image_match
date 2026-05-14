"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleProvider";
import { friendlyApiError } from "@/lib/i18n/api-errors";
import { FETCH_LOAD_TIMEOUT_MS, fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";
import type { ImageRow } from "@/server/match-service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { slug: string; disabled?: boolean };

export function MatchDuel({ slug, disabled }: Props) {
  const { t } = useLocale();
  const [left, setLeft] = useState<ImageRow | null>(null);
  const [right, setRight] = useState<ImageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leftImgReady, setLeftImgReady] = useState(false);
  const [rightImgReady, setRightImgReady] = useState(false);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const loadGenRef = useRef(0);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    const gen = ++loadGenRef.current;
    setErr(null);
    setImgLoadFailed(false);
    setLeftImgReady(false);
    setRightImgReady(false);
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
      setLeft(null);
      setRight(null);
      return;
    }
    if (gen !== loadGenRef.current) return;
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("duel.loadFail"));
      setLeft(null);
      setRight(null);
      return;
    }
    const j = await res.json();
    if (gen !== loadGenRef.current) return;
    setLeft(j.left);
    setRight(j.right);
  }, [slug, t]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setLeftImgReady(false);
      setRightImgReady(false);
      setImgLoadFailed(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [left?.id, right?.id]);

  useEffect(() => {
    if (!disabled) {
      queueMicrotask(() => {
        void load();
      });
    }
  }, [disabled, load]);

  /** 配对已返回但缩略图长时间未完成解码/拉取时，重新拉一对（防 CDN / 浏览器卡住） */
  useEffect(() => {
    if (disabled) return;
    if (!left || !right) return;
    if (leftImgReady && rightImgReady) return;
    const id = window.setTimeout(() => {
      void load();
    }, FETCH_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [disabled, left, right, leftImgReady, rightImgReady, load]);

  const vote = async (winner: ImageRow, loser: ImageRow) => {
    if (!left || !right || busy || !leftImgReady || !rightImgReady || imgLoadFailed) return;
    setBusy(true);
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
      setBusy(false);
      if (isAbortError(e)) {
        setErr(t("duel.requestTimeout"));
        void load();
        return;
      }
      setErr(t("duel.voteFail"));
      return;
    }
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("duel.voteFail"));
      return;
    }
    await load();
  };

  const skip = async () => {
    if (!left || !right || busy || !leftImgReady || !rightImgReady || imgLoadFailed) return;
    setBusy(true);
    setErr(null);
    try {
      await fetchWithTimeout(
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
    } finally {
      setBusy(false);
    }
    await load();
  };

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

  const imagesInteractive = leftImgReady && rightImgReady && !imgLoadFailed;
  const revealPair = imagesInteractive;
  const gateBusy = busy || !imagesInteractive;

  return (
    <div className="space-y-4">
      <p className="text-center text-xs leading-relaxed text-white/50 md:text-sm">
        {imgLoadFailed ? (
          <>
            <strong className="text-amber-200/90">{t("duel.voteHintFailed")}</strong>
            {t("duel.voteHintFailedSub")}
          </>
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
          image={left}
          side={t("duel.left")}
          busy={gateBusy}
          revealPair={revealPair}
          onPick={() => void vote(left, right)}
          onImageReady={() => setLeftImgReady(true)}
          onImageError={() => setImgLoadFailed(true)}
        />
        <DuelCard
          image={right}
          side={t("duel.right")}
          busy={gateBusy}
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
    </div>
  );
}

function DuelCard({
  image,
  side,
  onPick,
  busy,
  revealPair,
  onImageReady,
  onImageError,
}: {
  image: ImageRow;
  side: string;
  onPick: () => void;
  busy: boolean;
  /** 左右图都已解码完成：此时才同时露出画面，此前两侧均保持加载态 */
  revealPair: boolean;
  onImageReady: () => void;
  onImageError: () => void;
}) {
  const { t } = useLocale();
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
        {!revealPair ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40">
            <span className="text-[11px] font-medium text-white/55">{t("duel.loadingImg")}</span>
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
            revealPair && !busy && "group-hover:scale-[1.02]",
            !revealPair && "opacity-0"
          )}
          sizes="(max-width:768px) 46vw, 50vw"
          onLoadingComplete={onImageReady}
          onError={onImageError}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90 transition-opacity duration-300",
            !revealPair && "opacity-0"
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
          <span
            className={cn(
              "rounded-full bg-cyan-500/90 px-2 py-1 text-[10px] font-semibold text-slate-950 shadow-md transition duration-200 sm:px-3 sm:text-[11px]",
              revealPair ? "opacity-0 group-hover:opacity-100 max-md:opacity-100 md:opacity-100" : "opacity-0"
            )}
          >
            {t("duel.tapToVote")}
          </span>
        </div>
      </div>
      <div className="flex items-center border-t border-white/10 bg-black/25 px-3 py-2.5">
        <span className="text-[11px] text-white/45">{revealPair ? t("duel.tapReady") : t("duel.tapWait")}</span>
      </div>
    </motion.button>
  );
}
