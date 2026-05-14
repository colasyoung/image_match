"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
    window.location.href = `/m/${created.slug}`;
  }, [created]);

  const manageUrl = useMemo(() => {
    if (!created) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/manage/${created.slug}?token=${created.manageToken}`;
  }, [created]);

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
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-100/90">
            <p className="font-medium">草稿已创建</p>
            <p className="mt-2 break-all text-xs text-white/60">管理链接（请收藏）：{manageUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/manage/${created.slug}?token=${encodeURIComponent(created.manageToken)}`}
                className="text-xs font-medium text-cyan-200 underline"
              >
                打开管理页
              </Link>
              <span className="text-white/30">|</span>
              <Link href={`/m/${created.slug}`} className="text-xs text-white/55 hover:text-white/80">
                预览比赛页（草稿时他人不可见）
              </Link>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <label className="block space-y-2">
              <span className="text-xs text-white/55">上传图片（2–10 张，每张经服务端转存 imgbb）</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
                className="text-sm text-white/70"
              />
            </label>
            <div className="text-xs text-white/45">已选 {files.length} 张</div>
            {err ? <p className="text-sm text-amber-200/90">{err}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!files.length || loading} onClick={() => void uploadAll()}>
                {loading ? "上传中…" : "上传全部"}
              </Button>
              <Button variant="ghost" disabled={loading} onClick={() => void activate()}>
                开启比赛（≥2 张）
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
