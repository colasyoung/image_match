"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImagePickButton, ImageUploadHints } from "@/components/ImageUploadHints";
import { cn } from "@/lib/utils";

type Created = { slug: string; manageToken: string; id: string };

type ImageRow = { id: string; thumb_url: string | null; image_url: string };

type QueuedImage = { id: string; file: File; previewUrl: string };

function filterImageFiles(raw: File[]): File[] {
  return raw.filter(
    (f) =>
      (Boolean(f.type) && f.type.startsWith("image/")) ||
      /\.(jpe?g|png|gif|webp|avif|hei[c|f]|heic)$/i.test(f.name)
  );
}

function friendlyApiError(raw: string): string {
  const map: Record<string, string> = {
    Unauthorized: "没有权限，请检查管理链接是否完整。",
    "Not found": "找不到这场比赛。",
    Bad: "请求无效，请刷新页面重试。",
    "Need at least 2 images": "请先至少上传 2 张图片，再开启比赛。",
    "Cannot activate from current state": "当前状态无法开启，请刷新页面后重试。",
  };
  return map[raw] ?? raw;
}

function defaultTitleSuggestion(): string {
  const d = new Date();
  return `我的对战 · ${d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`;
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

export default function CreatePage() {
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

  const uploadedCountLive = useRef(0);

  const canCreate = title.trim().length > 0;
  const uploadedCount = uploadedImages.length;
  const needMore = Math.max(0, 2 - uploadedCount);
  const canActivate = uploadedCount >= 2 && !loading;
  const slotsLeft = Math.max(0, 10 - uploadedCount - queue.length);

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

  const addIncomingFiles = useCallback((list: FileList | null) => {
    const raw = list?.length ? Array.from(list) : [];
    if (!raw.length) return;
    const images = filterImageFiles(raw);
    if (!images.length) {
      setPickHint("没有发现图片文件，请选择 jpg、png、webp 等常见图片格式。");
      window.setTimeout(() => setPickHint(null), 4500);
      return;
    }

    let hint: string | null = null;
    setQueue((prev) => {
      const u = uploadedCountLive.current;
      const room = Math.max(0, 10 - u - prev.length);
      if (room <= 0) {
        hint = "已达上限：一共最多 10 张（含已上传）。请先点「上传」或删掉队列里的缩略图。";
        return prev;
      }
      const take = images.slice(0, room);
      const skipped = images.length - take.length;
      const additions = take.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 10)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      if (skipped > 0) {
        hint = `已加入 ${take.length} 张；另有 ${skipped} 张因超出上限未加入。`;
      } else {
        hint = `已加入 ${take.length} 张，当前队列 ${prev.length + take.length} 张（记得点下方「上传」）。`;
      }
      return [...prev, ...additions];
    });
    if (hint) {
      setPickHint(hint);
      window.setTimeout(() => setPickHint(null), 4500);
    }
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => {
      const q = prev.find((x) => x.id === id);
      if (q) URL.revokeObjectURL(q.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearQueueRevoke = useCallback(() => {
    setQueue((prev) => {
      prev.forEach((q) => URL.revokeObjectURL(q.previewUrl));
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
      setErr(friendlyApiError(j.error ?? "创建失败"));
      return;
    }
    const j = (await res.json()) as Created;
    clearQueueRevoke();
    setPickHint(null);
    setCreated({ slug: j.slug, manageToken: j.manageToken, id: j.id });
    setActivatedSuccess(false);
  }, [title, description, isPublic, clearQueueRevoke]);

  const uploadAll = useCallback(async () => {
    if (!created || queue.length === 0) return;
    setErr(null);
    setLoading(true);
    try {
      for (let i = 0; i < queue.length; i++) {
        const f = queue[i].file;
        setUploadPhase(`正在上传第 ${i + 1} / ${queue.length} 张…`);
        const fd = new FormData();
        fd.set("matchId", created.id);
        fd.set("manageToken", created.manageToken);
        fd.set("file", f);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "上传失败");
        }
      }
      setUploadPhase(null);
      clearQueueRevoke();
      setPickHint("上传完成！若未满 2 张请继续添加；够了即可开启比赛。");
      window.setTimeout(() => setPickHint(null), 5000);
      await refreshUploaded(created);
    } catch (e) {
      setUploadPhase(null);
      setErr(e instanceof Error ? e.message : "上传失败");
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [created, queue, refreshUploaded, clearQueueRevoke]);

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
      setErr(friendlyApiError(j.error ?? "开启失败（至少需要 2 张图）"));
      return;
    }
    setErr(null);
    setActivatedSuccess(true);
  }, [created, uploadedCount]);

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
      () => setErr("复制失败，请长按链接手动复制")
    );
  };

  const step1Done = Boolean(created);
  const step2Done = uploadedCount >= 2;
  const step3Done = activatedSuccess;

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-10 pb-16">
      <div>
        <Link href="/" className="text-sm text-cyan-300/90 hover:underline">
          ← 返回首页
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">创建一场对战</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          不用注册。按下面三步走即可：<strong className="text-white/75">起名</strong> → <strong className="text-white/75">传图</strong>{" "}
          → <strong className="text-white/75">开启</strong>。管理链接相当于密码，请复制保存。
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <StepBadge n={1} label="起名字" active={!step1Done} done={step1Done} />
        <StepBadge n={2} label="传至少 2 张图" active={step1Done && !step2Done && !step3Done} done={step2Done || step3Done} />
        <StepBadge n={3} label="开启投票" active={step1Done && step2Done && !step3Done} done={step3Done} />
      </div>

      {!created ? (
        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/85">对战标题</span>
              <span className="text-xs text-white/45">会显示在投票页顶部，随时可在管理页修改。</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                placeholder="例如：周末咖啡杯选美"
                autoComplete="off"
              />
            </label>
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-cyan-300/85 hover:underline"
                onClick={() => setTitle(defaultTitleSuggestion())}
              >
                帮我填一个标题
              </button>
            </div>
          </div>

          <details className="group rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <summary className="cursor-pointer list-none py-1 text-sm text-white/70 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-white/20 underline-offset-2 group-open:decoration-cyan-400/50">
                可选：简介、是否在首页展示
              </span>
            </summary>
            <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="block space-y-1">
                <span className="text-xs text-white/55">简介（选填）</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
                  placeholder="一两句话说明玩法或主题…"
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
                  <span className="text-sm text-white/85">在首页「发现」里展示这场对战</span>
                  <span className="mt-0.5 block text-xs text-white/45">关闭后只能通过你分享的投票链接访问。</span>
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
            {loading ? "正在创建…" : "下一步：创建草稿"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-lg shadow-amber-900/20">
            <p className="text-base font-semibold text-amber-100">第 1 件事：复制并保存「管理链接」</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/85">
              这是你<strong>以后改标题、删图、暂停或结束</strong>的唯一入口，和投票页不是同一个链接。
              <strong className="text-amber-50"> 丢了没法找回</strong>
              （除非你部署了总站 <code className="rounded bg-black/30 px-1">/admin?key=…</code>，见 README）。
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
                {copied === "manage" ? "已复制" : "复制管理链接"}
              </Button>
              <Link
                href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-medium text-white hover:bg-white/15"
              >
                打开管理页
              </Link>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs font-medium text-white/70">发给朋友投票用这个（不含管理权限）</p>
              <p className="mt-1 break-all font-mono text-[11px] text-cyan-100/90">{voteUrl}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 !min-h-9 !text-xs"
                onClick={() => copyText(voteUrl, "vote")}
              >
                {copied === "vote" ? "投票链接已复制" : "复制投票链接"}
              </Button>
            </div>
          </div>

          {activatedSuccess ? (
            <div className="space-y-4 rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-6 shadow-lg shadow-emerald-900/30">
              <p className="text-lg font-semibold text-emerald-50">可以了，大家已经能来投票了</p>
              <p className="text-sm leading-relaxed text-emerald-100/85">
                页面没有自动跳转，方便你先把<strong>管理链接</strong>存到备忘录或发给自己。
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="success"
                  className="min-h-11 px-6 text-base"
                  onClick={() => copyText(manageUrl, "manage")}
                >
                  {copied === "manage" ? "管理链接已复制" : "再复制一次管理链接"}
                </Button>
                <Link
                  href={`/m/${created.slug}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-slate-900 shadow hover:bg-white/90"
                >
                  进入投票页看看
                </Link>
                <Link
                  href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-6 text-base font-medium text-white hover:bg-white/10"
                >
                  去管理页继续传图
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ImageUploadHints compact />

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-medium text-white">第 2 件事：上传图片</h2>
                    <p className="mt-1 text-xs text-white/50">至少 2 张才能开启，最多 10 张。可以多次选择、分批上传。</p>
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium tabular-nums",
                      uploadedCount >= 2 ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-amber-100/90"
                    )}
                  >
                    已上传 {uploadedCount} / 10 张
                    {uploadedCount < 2 ? ` · 还差 ${needMore} 张` : " · 可以开启了"}
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
                          src={img.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
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
                  label={slotsLeft <= 0 ? "已达 10 张上限" : "点这里选择照片，或拖进来"}
                  subLabel={
                    slotsLeft <= 0
                      ? "请先上传或删掉队列里的图"
                      : `还可再添加约 ${slotsLeft} 个空位（含当前队列）`
                  }
                  onFiles={addIncomingFiles}
                />

                {queue.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-center text-xs text-white/50">
                      待上传队列（{queue.length} 张）— 选好之后点下方「上传」才会真正传到比赛里
                    </p>
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
                            aria-label="从队列移除"
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
                      ? "正在上传…"
                      : queue.length
                        ? `上传这 ${queue.length} 张到比赛`
                        : "请先选择或拖入图片"}
                  </Button>

                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-medium text-white/60">第 3 件事：开启投票</p>
                    <p className="mt-1 text-[11px] text-white/40">开启后路人就能打开投票页；你仍可用管理链接随时暂停。</p>
                    <Button
                      variant="success"
                      disabled={!canActivate}
                      className="mt-3 min-h-12 w-full text-base font-semibold"
                      onClick={() => void activate()}
                    >
                      {uploadedCount < 2
                        ? `还差 ${needMore} 张图才能开启`
                        : loading
                          ? "处理中…"
                          : "开启比赛，让大家来投票"}
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
