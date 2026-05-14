"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImagePickButton, ImageUploadHints } from "@/components/ImageUploadHints";
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

const STATUS_META: Record<string, { label: string; hint: string; pill: string }> = {
  draft: {
    label: "草稿",
    hint: "上传至少 2 张图后可开启比赛；未开启时投票页对他人不可见。",
    pill: "border-slate-400/40 bg-slate-500/20 text-slate-100",
  },
  active: {
    label: "进行中",
    hint: "用户可进行 1v1 投票；排行榜实时更新。",
    pill: "border-emerald-400/55 bg-emerald-500/25 text-emerald-50 shadow-[0_0_24px_-4px_rgba(52,211,153,0.35)]",
  },
  paused: {
    label: "已暂停",
    hint: "投票已关闭；可继续或结束比赛。若删图后不足 2 张，系统会自动暂停。",
    pill: "border-amber-400/50 bg-amber-500/20 text-amber-50",
  },
  ended: {
    label: "已结束",
    hint: "比赛已归档，用户无法再投票。",
    pill: "border-rose-400/45 bg-rose-500/20 text-rose-50",
  },
};

export function ManageClient({ slug }: { slug: string }) {
  const search = useSearchParams();
  const token = useMemo(() => search.get("token") ?? "", [search]);
  const [data, setData] = useState<MatchApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedPageUrl, setCopiedPageUrl] = useState(false);

  const pageUrl = useMemo(() => {
    if (typeof window === "undefined" || !token || !slug) return "";
    return `${window.location.origin}/manage/${slug}?token=${encodeURIComponent(token)}`;
  }, [slug, token]);

  const load = useCallback(async () => {
    await Promise.resolve();
    if (!token) {
      setErr("缺少 token 参数");
      return;
    }
    setErr(null);
    const res = await fetch(`/api/matches/${slug}?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "加载失败");
      setData(null);
      return;
    }
    setData(await res.json());
  }, [slug, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch schedules state updates after network I/O
    void load();
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
      setErr(j.error ?? "操作失败");
      return;
    }
    setErr(null);
    await load();
  };

  const removeMatch = async () => {
    if (!token || !confirm("确定删除整场比赛及全部数据？不可恢复。")) return;
    setLoading(true);
    const res = await fetch(`/api/matches/${slug}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "删除失败");
      return;
    }
    window.location.href = "/";
  };

  const deleteImage = async (imageId: string) => {
    if (!token || !confirm("确定删除这张图片？相关对战记录会随数据库级联清理。")) return;
    setLoading(true);
    const res = await fetch(
      `/api/matches/${slug}/images/${imageId}?token=${encodeURIComponent(token)}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "删除图片失败");
      return;
    }
    setErr(null);
    await load();
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!token || !data || !files?.length) return;
    if (data.images.length >= 10) {
      setErr("最多 10 张图片");
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const list = Array.from(files).slice(0, 10 - data.images.length);
      for (const f of list) {
        const fd = new FormData();
        fd.set("matchId", data.match.id);
        fd.set("manageToken", token);
        fd.set("file", f);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "上传失败");
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上传失败");
      setUploading(false);
      return;
    }
    setUploading(false);
    await load();
  };

  const status = data?.match.status ?? "";
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const canActivate = (data?.images.length ?? 0) >= 2;
  const isEnded = status === "ended";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-cyan-300/90 hover:underline">
          ← 首页
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">比赛管理</h1>
        <p className="mt-1 text-sm text-white/45">slug: {slug}</p>
      </div>

      {err ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</div>
      ) : null}

      {!token ? (
        <p className="text-white/50">请在 URL 中附带 <code className="text-cyan-200/90">?token=</code> 管理密钥。</p>
      ) : !data ? (
        <p className="text-white/50">加载中…</p>
      ) : (
        <>
          {pageUrl ? (
            <div className="rounded-2xl border-2 border-amber-400/35 bg-amber-500/10 p-4 shadow-md shadow-amber-950/40">
              <p className="text-sm font-medium text-amber-100">请收藏本页完整链接（含 token）</p>
              <p className="mt-1 text-xs text-amber-100/75">
                投票页 <code className="rounded bg-black/30 px-1">/m/{slug}</code>{" "}
                没有管理入口；丢失下方链接将无法再管理本场比赛。
              </p>
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
                    () => setErr("复制失败，请手动选择地址栏链接")
                  );
                }}
              >
                {copiedPageUrl ? "已复制" : "复制本页管理链接"}
              </Button>
            </div>
          ) : null}

          {/* 当前状态 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/40">当前状态</p>
                <h2 className="mt-1 text-lg font-medium text-white">{data.match.title}</h2>
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
                    投票 {data.match.vote_count} · 浏览 {data.match.view_count} · 图 {data.images.length}/10
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{meta.hint}</p>
              </div>
              <Link
                href={`/m/${data.match.slug}`}
                className="shrink-0 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20"
              >
                打开投票页
              </Link>
            </div>

            {/* 状态操作：高亮「可点」与「当前」 */}
            {!isEnded ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/40">切换状态</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {(status === "draft" || status === "paused") && (
                    <Button
                      disabled={loading || !canActivate}
                      variant="success"
                      className={cn(
                        "min-w-[8.5rem] justify-center sm:min-w-[10rem]",
                        !canActivate && "opacity-40"
                      )}
                      title={!canActivate ? "至少需要 2 张图片" : undefined}
                      onClick={() => void patch({ activate: true })}
                    >
                      {status === "draft" ? "开启比赛" : "继续（激活）"}
                    </Button>
                  )}
                  {status === "active" && (
                    <Button
                      disabled={loading}
                      variant="warning"
                      className="min-w-[8.5rem] justify-center sm:min-w-[10rem]"
                      onClick={() => void patch({ status: "paused" })}
                    >
                      暂停比赛
                    </Button>
                  )}
                  {(status === "active" || status === "paused" || status === "draft") && (
                    <Button
                      disabled={loading}
                      variant="danger"
                      className="min-w-[8.5rem] justify-center sm:min-w-[10rem]"
                      onClick={() => void patch({ status: "ended" })}
                    >
                      结束比赛
                    </Button>
                  )}
                </div>
                {!canActivate && (status === "draft" || status === "paused") ? (
                  <p className="mt-2 text-xs text-amber-200/80">开启或继续前：请先上传至少 2 张图片。</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 border-t border-white/10 pt-5 text-sm text-white/45">已结束的比赛不能切换状态。</p>
            )}
          </section>

          {/* 图片管理 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/40">图片列表</p>
                <h3 className="text-base font-medium text-white">增删图片</h3>
                <p className="mt-1 text-xs text-white/45">
                  经服务端上传到 imgbb；删除会清理相关对战数据。进行中也可增删（不足 2 张时进行中会自动暂停）。
                </p>
              </div>

              <ImageUploadHints />

              <ImagePickButton
                id="manage-upload-pick"
                disabled={loading || data.images.length >= 10}
                busy={uploading}
                label={data.images.length >= 10 ? "已达 10 张上限" : "点击选择图片上传"}
                subLabel="支持多选 · 每张单独提交 · 与创建页相同规则"
                onFiles={(list) => void uploadFiles(list)}
              />
            </div>

            {data.images.length === 0 ? (
              <p className="mt-6 text-center text-sm text-white/45">暂无图片，使用上方按钮上传。</p>
            ) : (
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {data.images.map((img) => (
                  <li
                    key={img.id}
                    className="group overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-inner"
                  >
                    <div className="relative aspect-square w-full">
                      <Image
                        src={img.thumb_url || img.image_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 50vw, 180px"
                        unoptimized
                      />
                    </div>
                    <div className="p-2">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={loading}
                        className="w-full py-1.5 text-xs"
                        onClick={() => void deleteImage(img.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 分享 */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">给观众分享的链接</p>
            <code className="mt-2 block break-all rounded-lg bg-black/40 p-3 text-xs text-cyan-100/90">
              {typeof window !== "undefined" ? window.location.origin : ""}/m/{data.match.slug}
            </code>
          </section>

          <Button variant="danger" disabled={loading} onClick={() => void removeMatch()}>
            删除整场比赛
          </Button>
        </>
      )}
    </div>
  );
}
