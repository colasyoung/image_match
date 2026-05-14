"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImagePickButton, ImageUploadHints } from "@/components/ImageUploadHints";

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    slug: string;
    manageToken: string;
    id: string;
  } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [copied, setCopied] = useState(false);
  /** 开启比赛成功后不再自动跳转，避免来不及复制管理链接 */
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  const canCreate = title.trim().length > 0;

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
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "创建失败");
      return;
    }
    const j = await res.json();
    setCreated({ slug: j.slug, manageToken: j.manageToken, id: j.id });
    setActivatedSuccess(false);
  }, [title, description, isPublic]);

  const uploadAll = useCallback(async () => {
    if (!created) return;
    setErr(null);
    setLoading(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.set("matchId", created.id);
        fd.set("manageToken", created.manageToken);
        fd.set("file", f);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "上传失败");
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上传失败");
      setLoading(false);
      return;
    }
    setLoading(false);
    setFiles([]);
  }, [created, files]);

  const activate = useCallback(async () => {
    if (!created) return;
    setErr(null);
    setLoading(true);
    const res = await fetch(`/api/matches/${created.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: created.manageToken, activate: true }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "开启失败（至少需要 2 张图）");
      return;
    }
    setErr(null);
    setActivatedSuccess(true);
  }, [created]);

  const manageUrl = useMemo(() => {
    if (!created) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/manage/${created.slug}?token=${created.manageToken}`;
  }, [created]);

  const copyManage = () => {
    void navigator.clipboard.writeText(manageUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
      () => setErr("复制失败，请手动全选上方链接")
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-cyan-300/90 hover:underline">
          ← 返回首页
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">创建比赛</h1>
        <p className="mt-2 text-sm text-white/55">无需登录。请保存好管理链接，丢失 token 将无法管理。</p>
      </div>

      {!created ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <label className="block space-y-1">
            <span className="text-xs text-white/55">标题</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
              placeholder="例如：春季校园摄影赛"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-white/55">简介（可选）</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            在首页公开展示
          </label>
          {err ? <p className="text-sm text-amber-200/90">{err}</p> : null}
          <Button disabled={!canCreate || loading} onClick={() => void create()}>
            {loading ? "创建中…" : "创建草稿"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-lg shadow-amber-900/20">
            <p className="text-base font-semibold text-amber-100">务必保存：管理页面入口</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/85">
              普通用户只会打开比赛页 <code className="rounded bg-black/30 px-1">/m/{created.slug}</code>。
              只有下面这个链接能<strong>暂停 / 结束 / 删图 / 再上传</strong>；<strong>丢失 token 后无法找回</strong>
              （除非配置了总站 <code className="rounded bg-black/30 px-1">/admin?key=…</code>，见 README）。
            </p>
            <p className="mt-3 break-all rounded-lg bg-black/35 p-3 font-mono text-[11px] leading-snug text-cyan-100/95">
              {manageUrl}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="!bg-amber-400/90 !text-slate-950 hover:!bg-amber-300"
                onClick={() => copyManage()}
              >
                {copied ? "已复制" : "复制管理链接"}
              </Button>
              <Link
                href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15"
              >
                打开管理页
              </Link>
            </div>
          </div>

          {activatedSuccess ? (
            <div className="space-y-4 rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-6 shadow-lg shadow-emerald-900/30">
              <p className="text-lg font-semibold text-emerald-50">比赛已开启</p>
              <p className="text-sm leading-relaxed text-emerald-100/85">
                未自动跳转，方便你先<strong>复制上方管理链接</strong>。投票页只用于打分，不含管理入口。
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button type="button" variant="success" className="min-h-11 px-6 text-base" onClick={() => void copyManage()}>
                  {copied ? "已复制管理链接" : "再复制一次管理链接"}
                </Button>
                <Link
                  href={`/m/${created.slug}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-slate-900 shadow hover:bg-white/90"
                >
                  进入投票页
                </Link>
                <Link
                  href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-6 text-base font-medium text-white hover:bg-white/10"
                >
                  去管理页上传更多图
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ImageUploadHints />

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <h2 className="text-sm font-medium text-white">上传图片</h2>
                <p className="text-xs text-white/50">需 2–10 张后再点「开启比赛」。可多选。</p>

                <ImagePickButton
                  id="create-upload-pick"
                  disabled={loading}
                  busy={loading}
                  label="点击选择图片上传"
                  subLabel="支持多选 · 每张单独提交到服务端"
                  onFiles={(list) => setFiles(Array.from(list ?? []).slice(0, 10))}
                />

                {files.length > 0 ? (
                  <p className="text-center text-sm text-white/70">已选 {files.length} 张，点击下方上传</p>
                ) : null}

                {err ? <p className="text-sm text-amber-200/90">{err}</p> : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    disabled={!files.length || loading}
                    className="min-h-11 flex-1 bg-cyan-500/85 text-base font-semibold text-slate-950 hover:bg-cyan-400"
                    onClick={() => void uploadAll()}
                  >
                    {loading ? "上传中…" : "上传已选图片"}
                  </Button>
                  <Button
                    variant="success"
                    disabled={loading}
                    className="min-h-11 flex-1 text-base font-semibold"
                    onClick={() => void activate()}
                  >
                    开启比赛（需 ≥2 张已上传）
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
