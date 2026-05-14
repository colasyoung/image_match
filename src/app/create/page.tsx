"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/contexts/LocaleProvider";
import { Button } from "@/components/ui/button";
import { ImagePickButton, ImageUploadHints } from "@/components/ImageUploadHints";
import { useAdminUploadBypass } from "@/hooks/useAdminUploadBypass";
import { friendlyApiError } from "@/lib/i18n/api-errors";
import { ADMIN_UPLOAD_BYPASS_QUERY } from "@/lib/admin-upload-bypass";
import { DEFAULT_MAX_IMAGES_PER_MATCH, effectiveImageCap } from "@/lib/match-limits";
import { cn } from "@/lib/utils";

type Created = { slug: string; manageToken: string; id: string };

type ImageRow = { id: string; thumb_url: string | null; image_url: string };

type QueuedImage =
  | { id: string; kind: "file"; file: File; previewUrl: string }
  | { id: string; kind: "url"; sourceUrl: string; previewUrl: string };

function filterImageFiles(raw: File[]): File[] {
  return raw.filter(
    (f) =>
      (Boolean(f.type) && f.type.startsWith("image/")) ||
      /\.(jpe?g|png|gif|webp|avif|hei[c|f]|heic)$/i.test(f.name)
  );
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 sm:px-3",
        done && "border-emerald-400/35 bg-emerald-500/10",
        active && !done && "border-cyan-400/45 bg-cyan-500/15",
        !active && !done && "border-white/10 bg-white/[0.04]"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
          done && "bg-emerald-400/90 text-slate-950",
          active && !done && "bg-cyan-400/90 text-slate-950",
          !active && !done && "bg-white/10 text-white/55"
        )}
      >
        {done ? "✓" : n}
      </span>
      <span className={cn("min-w-0 truncate text-[11px] font-medium sm:text-xs", done && "text-emerald-100/90", active && !done && "text-cyan-50")}>
        {label}
      </span>
    </div>
  );
}

function CreateSuspenseFallback() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-white/50">{t("create.loading")}</div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<CreateSuspenseFallback />}>
      <CreatePageInner />
    </Suspense>
  );
}

function CreatePageInner() {
  const { t, locale } = useLocale();
  const search = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [copied, setCopied] = useState<"manage" | "vote" | null>(null);
  const [activatedSuccess, setActivatedSuccess] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<ImageRow[]>([]);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [pickHint, setPickHint] = useState<string | null>(null);

  const { adminUploadBypassToken, setAdminUploadBypassToken } = useAdminUploadBypass();

  const uploadBypassFromUrl = useMemo(
    () => search.get(ADMIN_UPLOAD_BYPASS_QUERY)?.trim() ?? "",
    [search]
  );
  useEffect(() => {
    if (uploadBypassFromUrl) setAdminUploadBypassToken(uploadBypassFromUrl);
  }, [uploadBypassFromUrl, setAdminUploadBypassToken]);

  const uploadedCountLive = useRef(0);

  const canCreate = title.trim().length > 0;
  const uploadedCount = uploadedImages.length;
  const needMore = Math.max(0, 2 - uploadedCount);
  const canActivate = uploadedCount >= 2 && !loading;
  const imageCap = effectiveImageCap(adminUploadBypassToken);
  const slotsLeft = Math.max(0, imageCap - uploadedCount - queue.length);
  const maxImagesLabel = adminUploadBypassToken.trim() ? t("create.maxUnlimited") : String(DEFAULT_MAX_IMAGES_PER_MATCH);

  const defaultTitleSuggestion = useCallback(() => {
    const d = new Date();
    return (
      t("create.defaultTitlePrefix") +
      d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric" })
    );
  }, [locale, t]);

  useEffect(() => {
    uploadedCountLive.current = uploadedCount;
  }, [uploadedCount]);

  const refreshUploaded = useCallback(async (c: Created) => {
    const res = await fetch(`/api/matches/${c.slug}?token=${encodeURIComponent(c.manageToken)}`);
    if (!res.ok) return;
    const j = (await res.json()) as { images?: unknown };
    const raw = j.images;
    const list = Array.isArray(raw) ? raw : [];
    setUploadedImages(list as ImageRow[]);
  }, []);

  const addIncomingFiles = useCallback(
    (list: FileList | null) => {
      const cap = effectiveImageCap(adminUploadBypassToken);
      const raw = list?.length ? Array.from(list) : [];
      if (!raw.length) return;
      const images = filterImageFiles(raw);
      if (!images.length) {
        setPickHint(t("create.hintNoFiles"));
        window.setTimeout(() => setPickHint(null), 4500);
        return;
      }

      let hint: string | null = null;
      setQueue((prev) => {
        const u = uploadedCountLive.current;
        const room = Math.max(0, cap - u - prev.length);
        if (room <= 0) {
          hint =
            cap > DEFAULT_MAX_IMAGES_PER_MATCH ? t("create.hintQueueFullBypass") : t("create.hintQueueFull10");
          return prev;
        }
        const take = images.slice(0, room);
        const skipped = images.length - take.length;
        const additions = take.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 10)}`,
          kind: "file" as const,
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        if (skipped > 0) {
          hint = t("create.hintAddedTakeSkipped", { take: take.length, skipped });
        } else {
          hint = t("create.hintAddedTakeQueue", { take: take.length, total: prev.length + take.length });
        }
        return [...prev, ...additions];
      });
      if (hint) {
        setPickHint(hint);
        window.setTimeout(() => setPickHint(null), 4500);
      }
    },
    [adminUploadBypassToken, t]
  );

  const addIncomingUrls = useCallback(
    (urls: string[]) => {
      const cap = effectiveImageCap(adminUploadBypassToken);
      const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
      if (!unique.length) return;

      let hint: string | null = null;
      setQueue((prev) => {
        const u = uploadedCountLive.current;
        const room = Math.max(0, cap - u - prev.length);
        if (room <= 0) {
          hint =
            cap > DEFAULT_MAX_IMAGES_PER_MATCH ? t("create.hintQueueFullBypass") : t("create.hintQueueFull10");
          return prev;
        }

        const already = new Set<string>();
        for (const q of prev) {
          if (q.kind === "url") already.add(q.sourceUrl);
        }

        const take: string[] = [];
        for (const url of unique) {
          if (take.length >= room) break;
          if (already.has(url)) continue;
          take.push(url);
        }

        if (!take.length) {
          hint = unique.every((x) => already.has(x)) ? t("create.hintUrlsDup") : t("create.hintUrlsNoRoom");
          return prev;
        }

        const additions: QueuedImage[] = take.map((sourceUrl) => ({
          id: `url-${sourceUrl.slice(0, 24)}-${Math.random().toString(36).slice(2, 11)}`,
          kind: "url" as const,
          sourceUrl,
          previewUrl: sourceUrl,
        }));

        const dropped = unique.length - take.length;
        if (dropped > 0) {
          hint = t("create.hintUrlsPartial", { take: take.length, dropped });
        } else {
          hint = t("create.hintUrlsAll", { take: take.length });
        }
        return [...prev, ...additions];
      });
      if (hint) {
        setPickHint(hint);
        window.setTimeout(() => setPickHint(null), 5000);
      }
    },
    [adminUploadBypassToken, t]
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => {
      const q = prev.find((x) => x.id === id);
      if (q?.kind === "file") URL.revokeObjectURL(q.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearQueueRevoke = useCallback(() => {
    setQueue((prev) => {
      prev.forEach((q) => {
        if (q.kind === "file") URL.revokeObjectURL(q.previewUrl);
      });
      return [];
    });
  }, []);

  useEffect(() => {
    if (!created) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch schedules state updates after network I/O
    void refreshUploaded(created);
  }, [created, refreshUploaded]);

  const create = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/create-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || undefined, isPublic }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(friendlyApiError(j.error ?? "", t) || t("api.CreateFail"));
      return;
    }
    const j = (await res.json()) as Created;
    clearQueueRevoke();
    setPickHint(null);
    setCreated({ slug: j.slug, manageToken: j.manageToken, id: j.id });
    setActivatedSuccess(false);
  }, [title, description, isPublic, clearQueueRevoke, t]);

  const uploadAll = useCallback(async () => {
    if (!created || queue.length === 0) return;
    setErr(null);
    setLoading(true);
    try {
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        setUploadPhase(t("create.uploadProgress", { current: i + 1, total: queue.length }));
        const fd = new FormData();
        fd.set("matchId", created.id);
        fd.set("manageToken", created.manageToken);
        if (q.kind === "file") {
          fd.set("file", q.file);
        } else {
          fd.set("imageUrl", q.sourceUrl);
        }
        const bypass = adminUploadBypassToken.trim();
        if (bypass) fd.set("adminUploadBypassToken", bypass);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ? friendlyApiError(String(j.error), t) : t("api.UploadFail"));
        }
      }
      setUploadPhase(null);
      clearQueueRevoke();
      setPickHint(t("create.uploadDone"));
      window.setTimeout(() => setPickHint(null), 5000);
      await refreshUploaded(created);
    } catch (e) {
      setUploadPhase(null);
      setErr(e instanceof Error ? e.message : t("api.UploadFail"));
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [created, queue, refreshUploaded, clearQueueRevoke, adminUploadBypassToken, t]);

  const activate = useCallback(async () => {
    if (!created || uploadedCount < 2) return;
    setErr(null);
    setLoading(true);
    const res = await fetch(`/api/matches/${created.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: created.manageToken, activate: true }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(friendlyApiError(j.error ?? "", t) || t("create.activateFail"));
      return;
    }
    setErr(null);
    setActivatedSuccess(true);
  }, [created, uploadedCount, t]);

  const manageUrl = useMemo(() => {
    if (!created) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/manage/${created.slug}?token=${created.manageToken}`;
  }, [created]);

  const voteUrl = useMemo(() => {
    if (!created) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/m/${created.slug}`;
  }, [created]);

  const copyText = (text: string, kind: "manage" | "vote") => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 2500);
      },
      () => setErr(t("create.copyFail"))
    );
  };

  const step1Done = Boolean(created);
  const step2Done = uploadedCount >= 2;
  const step3Done = activatedSuccess;

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-10 pb-16">
      <div>
        <Link href="/" className="text-sm text-cyan-300/90 hover:underline">
          {t("create.backHome")}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{t("create.pageTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{t("create.pageIntro")}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <StepBadge n={1} label={t("create.stepName")} active={!step1Done} done={step1Done} />
        <StepBadge n={2} label={t("create.stepUpload")} active={step1Done && !step2Done && !step3Done} done={step2Done || step3Done} />
        <StepBadge n={3} label={t("create.stepActivate")} active={step1Done && step2Done && !step3Done} done={step3Done} />
      </div>

      {!created ? (
        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/85">{t("create.titleLabel")}</span>
              <span className="text-xs text-white/45">{t("create.titleHint")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                placeholder={t("create.placeholderTitle")}
                autoComplete="off"
              />
            </label>
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-cyan-300/85 hover:underline"
                onClick={() => setTitle(defaultTitleSuggestion())}
              >
                {t("create.suggestTitle")}
              </button>
            </div>
          </div>

          <details className="group rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <summary className="cursor-pointer list-none py-1 text-sm text-white/70 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-white/20 underline-offset-2 group-open:decoration-cyan-400/50">
                {t("create.optionalDetails")}
              </span>
            </summary>
            <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="block space-y-1">
                <span className="text-xs text-white/55">{t("create.descLabel")}</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                  placeholder={t("create.placeholderDesc")}
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>
                  <span className="text-sm text-white/85">{t("create.publicLabel")}</span>
                  <span className="mt-0.5 block text-xs text-white/45">{t("create.publicHint")}</span>
                </span>
              </label>
            </div>
          </details>

          {err ? <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100/90">{err}</p> : null}

          <Button
            disabled={!canCreate || loading}
            className="min-h-12 w-full text-base font-semibold"
            onClick={() => void create()}
          >
            {loading ? t("create.creating") : t("create.createDraft")}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-lg shadow-amber-900/20">
            <p className="text-base font-semibold text-amber-100">{t("create.manageFirstTitle")}</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/85">
              {t("create.manageFirstLead")}
              <strong className="text-amber-100/95">{t("create.manageFirstBold")}</strong>
              {t("create.manageAfterBold")}
              <strong className="text-amber-50">{t("create.manageLost")}</strong>
              {t("create.manageFirstTail")}
            </p>
            <p className="mt-3 break-all rounded-lg bg-black/35 p-3 font-mono text-[11px] leading-snug text-cyan-100/95">
              {manageUrl}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="!min-h-11 !bg-amber-400/90 !px-5 !text-sm !font-semibold !text-slate-950 hover:!bg-amber-300"
                onClick={() => copyText(manageUrl, "manage")}
              >
                {copied === "manage" ? t("create.copiedManage") : t("create.copyManage")}
              </Button>
              <Link
                href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-medium text-white hover:bg-white/15"
              >
                {t("create.openManage")}
              </Link>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs font-medium text-white/70">{t("create.voteForFriends")}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-cyan-100/90">{voteUrl}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 !min-h-9 !text-xs"
                onClick={() => copyText(voteUrl, "vote")}
              >
                {copied === "vote" ? t("create.copiedVote") : t("create.copyVote")}
              </Button>
            </div>
          </div>

          {activatedSuccess ? (
            <div className="space-y-4 rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-6 shadow-lg shadow-emerald-900/30">
              <p className="text-lg font-semibold text-emerald-50">{t("create.successTitle")}</p>
              <p className="text-sm leading-relaxed text-emerald-100/85">{t("create.successBody")}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="success"
                  className="min-h-11 px-6 text-base"
                  onClick={() => copyText(manageUrl, "manage")}
                >
                  {copied === "manage" ? t("create.manageCopiedShort") : t("create.copyManageAgain")}
                </Button>
                <Link
                  href={`/m/${created.slug}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-slate-900 shadow hover:bg-white/90"
                >
                  {t("create.goVote")}
                </Link>
                <Link
                  href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-6 text-base font-medium text-white hover:bg-white/10"
                >
                  {t("create.goManageMore")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ImageUploadHints compact />

              <details className="rounded-xl border border-amber-400/25 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100/85">
                <summary className="cursor-pointer select-none font-medium text-amber-200/95">{t("create.adminSummary")}</summary>
                <p className="mt-2 leading-relaxed text-amber-100/75">{t("create.adminBody")}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={t("create.adminPlaceholder")}
                    value={adminUploadBypassToken}
                    onChange={(e) => setAdminUploadBypassToken(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white placeholder:text-white/35"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 text-xs text-white/55"
                    onClick={() => setAdminUploadBypassToken("")}
                  >
                    {t("create.clear")}
                  </Button>
                </div>
              </details>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-medium text-white">{t("create.uploadTitle")}</h2>
                    <p className="mt-1 text-xs text-white/50">
                      {t("create.uploadHint", { max: DEFAULT_MAX_IMAGES_PER_MATCH })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium tabular-nums",
                      uploadedCount >= 2 ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-amber-100/90"
                    )}
                  >
                    {t("create.uploaded", { count: uploadedCount, max: maxImagesLabel })}
                    {uploadedCount < 2 ? t("create.needMore", { n: needMore }) : t("create.readyOpen")}
                  </div>
                </div>

                {uploadedCount > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {uploadedImages.map((img) => (
                      <li
                        key={img.id}
                        className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/15 bg-black/40 shadow-sm"
                      >
                        <Image
                          src={img.thumb_url || img.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          quality={70}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}

                {pickHint ? (
                  <p className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-center text-sm text-emerald-50/95">
                    {pickHint}
                  </p>
                ) : null}

                <ImagePickButton
                  id="create-upload-pick"
                  disabled={loading || slotsLeft <= 0}
                  busy={loading}
                  label={
                    slotsLeft <= 0
                      ? adminUploadBypassToken.trim()
                        ? t("create.pickNoSlotBypass")
                        : t("create.pickNoSlot10")
                      : t("create.pickLabel")
                  }
                  subLabel={
                    slotsLeft <= 0 ? t("create.pickSubWait") : t("create.pickSubFull", { n: slotsLeft })
                  }
                  onFiles={addIncomingFiles}
                  onWebImageUrls={addIncomingUrls}
                />

                {queue.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-center text-xs text-white/50">{t("create.queueTitle", { n: queue.length })}</p>
                    <ul className="flex flex-wrap justify-center gap-2">
                      {queue.map((q) => (
                        <li key={q.id} className="relative">
                          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-cyan-400/30 bg-black/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={q.previewUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                          <button
                            type="button"
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-[10px] text-white shadow hover:bg-red-500/90"
                            onClick={() => removeFromQueue(q.id)}
                            aria-label={t("create.removeQueueAria")}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {uploadPhase ? <p className="text-center text-sm text-cyan-200/90">{uploadPhase}</p> : null}
                {err ? <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100/90">{err}</p> : null}

                <div className="flex flex-col gap-3">
                  <Button
                    disabled={!queue.length || loading}
                    className="min-h-12 w-full bg-cyan-500/85 text-base font-semibold text-slate-950 hover:bg-cyan-400"
                    onClick={() => void uploadAll()}
                  >
                    {loading && queue.length > 0
                      ? t("create.uploading")
                      : queue.length
                        ? t("create.uploadN", { n: queue.length })
                        : t("create.chooseFirst")}
                  </Button>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-medium text-white/60">{t("create.activateTitle")}</p>
                    <p className="mt-1 text-[11px] text-white/40">{t("create.activateHint")}</p>
                    <Button
                      variant="success"
                      disabled={!canActivate}
                      className="mt-3 min-h-12 w-full text-base font-semibold"
                      onClick={() => void activate()}
                    >
                      {uploadedCount < 2
                        ? t("create.needNToOpen", { n: needMore })
                        : loading
                          ? t("create.processing")
                          : t("create.activateBtn")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
