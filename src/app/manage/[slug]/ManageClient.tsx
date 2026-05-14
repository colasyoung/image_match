"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/contexts/LocaleProvider";
import { Button } from "@/components/ui/button";
import { ImagePickButton, ImageUploadHints } from "@/components/ImageUploadHints";
import { useAdminUploadBypass } from "@/hooks/useAdminUploadBypass";
import { friendlyApiError } from "@/lib/i18n/api-errors";
import { FETCH_LOAD_TIMEOUT_MS, fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";
import { ADMIN_UPLOAD_BYPASS_QUERY } from "@/lib/admin-upload-bypass";
import { DEFAULT_MAX_IMAGES_PER_MATCH, effectiveImageCap } from "@/lib/match-limits";
import { publicImageSrc } from "@/lib/public-image-src";
import { cn } from "@/lib/utils";

type MatchApi = {
  match: {
    id: string;
    slug: string;
    title: string;
    status: string;
    vote_count: number;
    view_count: number;
    is_public: boolean;
  };
  images: {
    id: string;
    image_url: string;
    thumb_url: string | null;
    elo_rating: number;
    battle_count: number;
    sort_order: number;
  }[];
};

export function ManageClient({ slug }: { slug: string }) {
  const { t } = useLocale();
  const statusMeta = useMemo(
    () => ({
      draft: {
        label: t("status.draftLabel"),
        hint: t("status.draftHint"),
        pill: "border-slate-400/40 bg-slate-500/20 text-slate-100",
      },
      active: {
        label: t("status.activeLabel"),
        hint: t("status.activeHint"),
        pill: "border-emerald-400/55 bg-emerald-500/25 text-emerald-50 shadow-[0_0_24px_-4px_rgba(52,211,153,0.35)]",
      },
      paused: {
        label: t("status.pausedLabel"),
        hint: t("status.pausedHint"),
        pill: "border-amber-400/50 bg-amber-500/20 text-amber-50",
      },
      ended: {
        label: t("status.endedLabel"),
        hint: t("status.endedHint"),
        pill: "border-rose-400/45 bg-rose-500/20 text-rose-50",
      },
    }),
    [t]
  );

  const search = useSearchParams();
  const token = useMemo(() => search.get("token") ?? "", [search]);
  const [data, setData] = useState<MatchApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedPageUrl, setCopiedPageUrl] = useState(false);
  const [copiedVoteUrl, setCopiedVoteUrl] = useState(false);
  const [copiedAudienceUrl, setCopiedAudienceUrl] = useState(false);
  const [momentsHint, setMomentsHint] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  const { adminUploadBypassToken, setAdminUploadBypassToken } = useAdminUploadBypass();

  const uploadBypassFromUrl = useMemo(
    () => search.get(ADMIN_UPLOAD_BYPASS_QUERY)?.trim() ?? "",
    [search]
  );
  useEffect(() => {
    if (uploadBypassFromUrl) setAdminUploadBypassToken(uploadBypassFromUrl);
  }, [uploadBypassFromUrl, setAdminUploadBypassToken]);

  const pageUrl = useMemo(() => {
    if (typeof window === "undefined" || !token || !slug) return "";
    return `${window.location.origin}/manage/${slug}?token=${encodeURIComponent(token)}`;
  }, [slug, token]);

  const votePageUrl = useMemo(() => {
    if (typeof window === "undefined" || !slug) return "";
    return `${window.location.origin}/m/${slug}`;
  }, [slug]);

  const loadRef = useRef<(() => Promise<void>) | null>(null);
  const load = useCallback(async () => {
    await Promise.resolve();
    if (!token) {
      setErr(t("manage.noToken"));
      return;
    }
    setErr(null);
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `/api/matches/${slug}?token=${encodeURIComponent(token)}`,
        undefined,
        FETCH_LOAD_TIMEOUT_MS
      );
    } catch (e) {
      if (isAbortError(e)) {
        void loadRef.current?.();
        return;
      }
      setErr(t("manage.loadFail"));
      setData(null);
      setTitleDraft("");
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("manage.loadFail"));
      setData(null);
      setTitleDraft("");
      return;
    }
    const payload = (await res.json()) as MatchApi;
    setData(payload);
    setTitleDraft(payload.match.title);
  }, [slug, token, t]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    if (!token) return;
    setLoading(true);
    const res = await fetch(`/api/matches/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("manage.opFail"));
      return;
    }
    setErr(null);
    await load();
  };

  /** 与「结束比赛」相同：永久删除本场比赛（二次确认） */
  const deleteMatchPermanently = async () => {
    if (!token) return;
    if (!confirm(t("manage.deleteMatch1"))) {
      return;
    }
    if (!confirm(t("manage.deleteMatch2"))) return;
    setLoading(true);
    const res = await fetch(`/api/matches/${slug}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("manage.deleteFail"));
      return;
    }
    window.location.href = "/";
  };

  const replaceImage = async (imageId: string, opts: { file?: File; imageUrl?: string }) => {
    if (!token || !data) return;
    const bypass = adminUploadBypassToken.trim();
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("matchId", data.match.id);
      fd.set("manageToken", token);
      fd.set("replaceImageId", imageId);
      if (opts.file) fd.set("file", opts.file);
      else if (opts.imageUrl) fd.set("imageUrl", opts.imageUrl);
      if (bypass) fd.set("adminUploadBypassToken", bypass);
      const res = await fetch("/api/upload-image", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ? friendlyApiError(String(j.error), t) : t("manage.replaceFail"));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("manage.replaceFail"));
      setUploading(false);
      return;
    }
    setUploading(false);
    await load();
  };

  const deleteImage = async (imageId: string) => {
    if (!token || !confirm(t("manage.confirmDeleteImg"))) return;
    setLoading(true);
    const res = await fetch(
      `/api/matches/${slug}/images/${imageId}?token=${encodeURIComponent(token)}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ? friendlyApiError(String(j.error), t) : t("manage.deleteImgFail"));
      return;
    }
    setErr(null);
    await load();
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!token || !data || !files?.length) return;
    const cap = effectiveImageCap(adminUploadBypassToken);
    if (data.images.length >= cap) {
      setErr(adminUploadBypassToken.trim() ? t("manage.atCapBypass") : t("manage.atCap10"));
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const list = Array.from(files).slice(0, cap - data.images.length);
      const bypass = adminUploadBypassToken.trim();
      for (const f of list) {
        const fd = new FormData();
        fd.set("matchId", data.match.id);
        fd.set("manageToken", token);
        fd.set("file", f);
        if (bypass) fd.set("adminUploadBypassToken", bypass);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ? friendlyApiError(String(j.error), t) : t("api.UploadFail"));
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("api.UploadFail"));
      setUploading(false);
      return;
    }
    setUploading(false);
    await load();
  };

  const uploadWebUrls = async (urls: string[]) => {
    if (!token || !data || !urls.length) return;
    const cap = effectiveImageCap(adminUploadBypassToken);
    if (data.images.length >= cap) {
      setErr(adminUploadBypassToken.trim() ? t("manage.atCapBypass") : t("manage.atCap10"));
      return;
    }
    const room = cap - data.images.length;
    const take = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, room);
    if (!take.length) return;

    setUploading(true);
    setErr(null);
    const bypass = adminUploadBypassToken.trim();
    try {
      for (const imageUrl of take) {
        const fd = new FormData();
        fd.set("matchId", data.match.id);
        fd.set("manageToken", token);
        fd.set("imageUrl", imageUrl);
        if (bypass) fd.set("adminUploadBypassToken", bypass);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ? friendlyApiError(String(j.error), t) : t("api.UploadFail"));
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("api.UploadFail"));
      setUploading(false);
      await load();
      return;
    }
    setUploading(false);
    await load();
  };

  const status = data?.match.status ?? "";
  const meta = statusMeta[status as keyof typeof statusMeta] ?? statusMeta.draft;
  const canActivate = (data?.images.length ?? 0) >= 2;
  const isEnded = status === "ended";
  const imageCap = data ? effectiveImageCap(adminUploadBypassToken) : DEFAULT_MAX_IMAGES_PER_MATCH;
  const maxImagesLabel = adminUploadBypassToken.trim() ? t("create.maxUnlimited") : String(DEFAULT_MAX_IMAGES_PER_MATCH);
  const atImageCap = data ? data.images.length >= imageCap : false;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-cyan-300/90 hover:underline">
          {t("manage.backHome")}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{t("manage.pageTitle")}</h1>
        <p className="mt-1 text-sm text-white/45">slug: {slug}</p>
      </div>

      {err ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</div>
      ) : null}

      {!token ? (
        <p className="text-white/50">{t("manage.needToken")}</p>
      ) : !data ? (
        <p className="text-white/50">{t("manage.loading")}</p>
      ) : (
        <>
          {pageUrl ? (
            <div className="rounded-2xl border-2 border-amber-400/35 bg-amber-500/10 p-4 shadow-md shadow-amber-950/40">
              <p className="text-sm font-medium text-amber-100">{t("manage.favoritelinkTitle")}</p>
              <p className="mt-1 text-xs text-amber-100/75">{t("manage.favoritelinkBody", { slug })}</p>
              {votePageUrl ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                  <p className="text-[11px] font-medium text-white/60">{t("manage.voteLinkLabel")}</p>
                  <code className="mt-1 block max-h-20 overflow-auto break-all text-[10px] leading-relaxed text-cyan-100/90">
                    {votePageUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 !border-cyan-400/40 !text-cyan-50 hover:!bg-cyan-500/15"
                    onClick={() => {
                      void navigator.clipboard.writeText(votePageUrl).then(
                        () => {
                          setCopiedVoteUrl(true);
                          setTimeout(() => setCopiedVoteUrl(false), 2500);
                        },
                        () => setErr(t("manage.copyVoteFail"))
                      );
                    }}
                  >
                    {copiedVoteUrl ? t("manage.copiedVote") : t("manage.copyVote")}
                  </Button>
                </div>
              ) : null}
              <p className="mt-3 text-[11px] text-amber-100/65">{t("manage.manageLinkLabel")}</p>
              <code className="mt-2 block max-h-24 overflow-auto break-all rounded-lg bg-black/40 p-2 text-[10px] leading-relaxed text-cyan-100/90">
                {pageUrl}
              </code>
              <Button
                type="button"
                className="mt-3 !bg-amber-400/90 !text-slate-950 hover:!bg-amber-300"
                onClick={() => {
                  void navigator.clipboard.writeText(pageUrl).then(
                    () => {
                      setCopiedPageUrl(true);
                      setTimeout(() => setCopiedPageUrl(false), 2500);
                    },
                    () => setErr(t("manage.copyPageFail"))
                  );
                }}
              >
                {copiedPageUrl ? t("manage.copied") : t("manage.copyManage")}
              </Button>
            </div>
          ) : null}

          {/* 当前状态 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/40">{t("manage.currentStatus")}</p>
                <label className="mt-2 block space-y-1">
                  <span className="text-xs text-white/45">{t("manage.matchTitle")}</span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      maxLength={120}
                      autoComplete="off"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-lg font-medium text-white outline-none ring-cyan-400/40 focus:ring-2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 !border-cyan-400/35 !text-cyan-50"
                      disabled={
                        loading ||
                        titleDraft.trim().length === 0 ||
                        titleDraft.trim() === data.match.title.trim()
                      }
                      onClick={() => {
                        const next = titleDraft.trim();
                        if (!next) {
                          setErr(t("manage.titleEmpty"));
                          return;
                        }
                        if (next === data.match.title.trim()) return;
                        void patch({ title: next });
                      }}
                    >
                      {t("manage.saveTitle")}
                    </Button>
                  </div>
                  <p className="text-[11px] text-white/35">{t("manage.titleHintManage")}</p>
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
                      meta.pill
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-white/40">
                    {t("manage.votesLine", {
                      votes: data.match.vote_count,
                      views: data.match.view_count,
                      images: data.images.length,
                      max: imageCap,
                    })}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{meta.hint}</p>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={`/m/${data.match.slug}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20"
                >
                  {t("manage.openVote")}
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  className="!border-cyan-400/35 !text-cyan-50"
                  onClick={() => {
                    if (!votePageUrl) return;
                    void navigator.clipboard.writeText(votePageUrl).then(
                      () => {
                        setCopiedVoteUrl(true);
                        setTimeout(() => setCopiedVoteUrl(false), 2500);
                      },
                      () => setErr(t("manage.copyFail"))
                    );
                  }}
                >
                  {copiedVoteUrl ? t("manage.copiedVoteShort") : t("manage.copyVoteQuick")}
                </Button>
              </div>
            </div>

            {/* 状态操作：高亮「可点」与「当前」 */}
            {!isEnded ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/40">{t("manage.switchStatus")}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {(status === "draft" || status === "paused") && (
                    <Button
                      disabled={loading || !canActivate}
                      variant="success"
                      className={cn(
                        "min-w-[8.5rem] justify-center sm:min-w-[10rem]",
                        !canActivate && "opacity-40"
                      )}
                      title={!canActivate ? t("manage.needTwoImages") : undefined}
                      onClick={() => void patch({ activate: true })}
                    >
                      {status === "draft" ? t("manage.openMatch") : t("manage.resume")}
                    </Button>
                  )}
                  {status === "active" && (
                    <Button
                      disabled={loading}
                      variant="warning"
                      className="min-w-[8.5rem] justify-center sm:min-w-[10rem]"
                      onClick={() => void patch({ status: "paused" })}
                    >
                      {t("manage.pause")}
                    </Button>
                  )}
                  {(status === "active" || status === "paused" || status === "draft") && (
                    <Button
                      disabled={loading}
                      variant="danger"
                      className="min-w-[8.5rem] justify-center sm:min-w-[10rem]"
                      title={t("manage.endDeleteTitle")}
                      onClick={() => void deleteMatchPermanently()}
                    >
                      {t("manage.endDelete")}
                    </Button>
                  )}
                </div>
                {!canActivate && (status === "draft" || status === "paused") ? (
                  <p className="mt-2 text-xs text-amber-200/80">{t("manage.needTwoBeforeOpen")}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <p className="text-sm text-white/45">{t("manage.endedBlock")}</p>
                <p className="text-xs text-white/35">{t("manage.endedDeleteNote")}</p>
                <Button
                  type="button"
                  variant="danger"
                  disabled={loading}
                  className="min-w-[8.5rem]"
                  onClick={() => void deleteMatchPermanently()}
                >
                  {t("manage.deleteMatch")}
                </Button>
              </div>
            )}
          </section>

          {/* 图片管理 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/40">{t("manage.imageList")}</p>
                <h3 className="text-base font-medium text-white">{t("manage.imageManageTitle")}</h3>
                <p className="mt-1 text-xs text-white/45">
                  {t("manage.imageManageHint", { count: data.images.length, max: maxImagesLabel })}
                </p>
              </div>

              <ImageUploadHints />

              <ImagePickButton
                id="manage-upload-pick"
                disabled={loading || atImageCap}
                busy={uploading}
                label={
                  atImageCap
                    ? adminUploadBypassToken.trim()
                      ? t("manage.pickAtCapBypass")
                      : t("manage.pickAtCap10")
                    : t("manage.pickLabel")
                }
                subLabel={t("manage.pickSub")}
                onFiles={(list) => void uploadFiles(list)}
                onWebImageUrls={(u) => void uploadWebUrls(u)}
              />
            </div>

            {data.images.length === 0 ? (
              <p className="mt-6 text-center text-sm text-white/45">{t("manage.noImages")}</p>
            ) : (
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.images.map((img) => (
                  <li
                    key={img.id}
                    className="group overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-inner"
                  >
                    <div className="relative aspect-square w-full">
                      <Image
                        src={publicImageSrc(img.thumb_url || img.image_url)}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 50vw, 180px"
                        quality={70}
                        loading="lazy"
                      />
                    </div>
                    <input
                      id={`manage-replace-file-${img.id}`}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void replaceImage(img.id, { file });
                      }}
                    />
                    <div className="space-y-1.5 p-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || uploading}
                          className="w-full py-1.5 text-[11px] !border-cyan-400/35 !text-cyan-50"
                          onClick={() => document.getElementById(`manage-replace-file-${img.id}`)?.click()}
                        >
                          {t("manage.replaceFile")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || uploading}
                          className="w-full py-1.5 text-[11px] !border-cyan-400/35 !text-cyan-50"
                          onClick={() => {
                            const raw = window.prompt(t("manage.replaceUrlPrompt"));
                            const u = raw?.trim();
                            if (!u) return;
                            void replaceImage(img.id, { imageUrl: u });
                          }}
                        >
                          {t("manage.replaceUrl")}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={loading}
                        className="w-full py-1.5 text-xs"
                        onClick={() => void deleteImage(img.id)}
                      >
                        {t("manage.delete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 分享 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">{t("manage.shareAudience")}</p>
            <code className="mt-2 block break-all rounded-lg bg-black/40 p-3 text-xs text-cyan-100/90">
              {votePageUrl || `…/m/${data.match.slug}`}
            </code>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="!border-cyan-400/40 !text-cyan-50 hover:!bg-cyan-500/15"
                disabled={!votePageUrl}
                onClick={() => {
                  if (!votePageUrl) return;
                  void navigator.clipboard.writeText(votePageUrl).then(
                    () => {
                      setCopiedAudienceUrl(true);
                      setMomentsHint(null);
                      setTimeout(() => setCopiedAudienceUrl(false), 2500);
                    },
                    () => setErr(t("manage.copyFail2"))
                  );
                }}
              >
                {copiedAudienceUrl ? t("manage.copied") : t("manage.copyQuick")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="!border-white/20 !text-white/80 hover:!bg-white/10"
                disabled={!votePageUrl}
                title={t("manage.momentsTitle")}
                onClick={() => {
                  if (!votePageUrl) return;
                  void navigator.clipboard.writeText(votePageUrl).then(
                    () => {
                      setCopiedAudienceUrl(true);
                      setTimeout(() => setCopiedAudienceUrl(false), 2500);
                      const inWeChat =
                        typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);
                      setMomentsHint(inWeChat ? t("manage.momentsInWeChat") : t("manage.momentsOutWeChat"));
                      window.setTimeout(() => setMomentsHint(null), 16_000);
                    },
                    () => setErr(t("manage.copyFail2"))
                  );
                }}
              >
                {t("manage.wechatMoments")}
              </Button>
            </div>
            {momentsHint ? (
              <p className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs leading-relaxed text-cyan-100/90">
                {momentsHint}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
