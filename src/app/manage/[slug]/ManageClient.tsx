"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  images: { id: string }[];
};

export function ManageClient({ slug }: { slug: string }) {
  const search = useSearchParams();
  const token = useMemo(() => search.get("token") ?? "", [search]);
  const [data, setData] = useState<MatchApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    await load();
  };

  const remove = async () => {
    if (!token || !confirm("确定删除该比赛？不可恢复。")) return;
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

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <Link href="/" className="text-sm text-cyan-300/90 hover:underline">
        ← 首页
      </Link>
      <h1 className="text-2xl font-semibold text-white">管理比赛</h1>
      {err ? <p className="text-sm text-amber-200/90">{err}</p> : null}
      {!token ? null : !data ? (
        <p className="text-white/50">加载中…</p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="text-sm text-white/80">{data.match.title}</div>
          <div className="text-xs text-white/45">
            slug: {data.match.slug} · 状态 {data.match.status} · 图片 {data.images.length} 张
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={loading} onClick={() => void patch({ status: "active" })}>
              开启
            </Button>
            <Button disabled={loading} variant="ghost" onClick={() => void patch({ status: "paused" })}>
              暂停
            </Button>
            <Button disabled={loading} variant="ghost" onClick={() => void patch({ status: "ended" })}>
              结束
            </Button>
          </div>
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs text-white/45">分享</p>
            <code className="block break-all rounded-lg bg-black/40 p-2 text-[11px] text-cyan-100/90">
              {typeof window !== "undefined" ? window.location.origin : ""}/m/{data.match.slug}
            </code>
          </div>
          <Button variant="danger" disabled={loading} onClick={() => void remove()}>
            删除比赛
          </Button>
        </div>
      )}
    </div>
  );
}
