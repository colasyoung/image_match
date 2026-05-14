"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

export type AdminMatchRow = {
  slug: string;
  title: string;
  status: string;
  manage_token: string;
  vote_count: number;
  view_count: number;
  image_count: number;
  created_at: string;
};

function absUrl(origin: string, path: string) {
  return origin ? `${origin}${path}` : path;
}

export function AdminMatchesTable({ rows, origin }: { rows: AdminMatchRow[]; origin: string }) {
  const router = useRouter();
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2200);
  }, []);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`已复制：${label}`);
    } catch {
      toast("复制失败，请手动选择链接");
    }
  };

  const deleteRow = async (row: AdminMatchRow) => {
    if (
      !confirm(
        `确定删除比赛「${row.title}」及全部图片、投票记录？\n此操作不可恢复。`
      )
    ) {
      return;
    }
    setBusySlug(row.slug);
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(row.slug)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: row.manage_token }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast(j.error ?? "删除失败");
        return;
      }
      toast("已删除");
      router.refresh();
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <div className="space-y-2">
      {flash ? (
        <p className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-center text-sm text-emerald-50/95">
          {flash}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-3 py-3">标题</th>
              <th className="px-3 py-3">slug</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-3 py-3 text-right">图片</th>
              <th className="px-3 py-3 text-right">票数</th>
              <th className="px-3 py-3 text-right">浏览</th>
              <th className="px-3 py-3">管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((m) => {
              const managePath = `/manage/${encodeURIComponent(m.slug)}?token=${encodeURIComponent(m.manage_token)}`;
              const votePath = `/m/${encodeURIComponent(m.slug)}`;
              const manageAbs = absUrl(origin, managePath);
              const voteAbs = absUrl(origin, votePath);
              const busy = busySlug === m.slug;
              return (
                <tr key={m.slug} className="text-white/85">
                  <td className="max-w-[180px] truncate px-3 py-2.5 font-medium">{m.title}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-white/60">{m.slug}</td>
                  <td className="px-3 py-2.5 text-xs">{m.status}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{m.image_count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.vote_count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{m.view_count}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                      <Link href={managePath} className="text-cyan-300/90 underline hover:text-cyan-200">
                        打开管理
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        className="!h-8 !min-h-0 !px-2.5 !py-1 !text-[11px]"
                        disabled={busy}
                        onClick={() => void copyText("管理页链接", manageAbs)}
                      >
                        复制管理
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="!h-8 !min-h-0 !px-2.5 !py-1 !text-[11px]"
                        disabled={busy}
                        onClick={() => void copyText("投票页链接", voteAbs)}
                      >
                        复制投票
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="!h-8 !min-h-0 !px-2.5 !py-1 !text-[11px]"
                        disabled={busy}
                        onClick={() => void deleteRow(m)}
                      >
                        {busy ? "删除中…" : "删除"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/45">暂无比赛</p>
        ) : null}
      </div>
    </div>
  );
}
