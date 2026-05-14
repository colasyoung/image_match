"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { ImageRow } from "@/server/match-service";
import { Button } from "@/components/ui/button";

type Props = { slug: string; disabled?: boolean };

export function MatchDuel({ slug, disabled }: Props) {
  const [left, setLeft] = useState<ImageRow | null>(null);
  const [right, setRight] = useState<ImageRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setErr(null);
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
    if (!disabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch schedules state updates after network I/O
      void load();
    }
  }, [disabled, load]);

  const vote = async (winner: ImageRow, loser: ImageRow) => {
    if (!left || !right || busy) return;
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
    if (!left || !right || busy) return;
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
        比赛未开启或已暂停，无法投票。
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
    return <div className="animate-pulse text-center text-white/50">加载对战中…</div>;
  }

  return (
    <div className="space-y-6">
      {err ? <p className="text-center text-sm text-amber-200/90">{err}</p> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <DuelCard
          image={left}
          label="左侧"
          busy={busy}
          onPick={() => void vote(left, right)}
        />
        <DuelCard
          image={right}
          label="右侧"
          busy={busy}
          onPick={() => void vote(right, left)}
        />
      </div>
      <div className="flex justify-center">
        <Button variant="ghost" disabled={busy} onClick={() => void skip()}>
          跳过
        </Button>
      </div>
    </div>
  );
}

function DuelCard({
  image,
  label,
  onPick,
  busy,
}: {
  image: ImageRow;
  label: string;
  onPick: () => void;
  busy: boolean;
}) {
  const src = image.thumb_url || image.image_url;
  return (
    <motion.button
      type="button"
      disabled={busy}
      onClick={onPick}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left shadow-2xl shadow-black/40 backdrop-blur transition hover:border-cyan-400/40"
    >
      <div className="absolute left-3 top-3 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/80 backdrop-blur">
        {label}
      </div>
      <div className="relative aspect-[4/5] w-full bg-black/40">
        <Image src={src} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" unoptimized />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
      </div>
      <div className="flex items-center justify-center px-4 py-3 text-center text-xs text-white/55">
        点选你更喜欢的一边
      </div>
    </motion.button>
  );
}
