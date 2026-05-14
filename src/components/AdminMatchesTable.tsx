"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useLocale } from "@/contexts/LocaleProvider";
import { friendlyApiError } from "@/lib/i18n/api-errors";
import { matchStatusDisplay } from "@/lib/match-status-label";
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
  const { t } = useLocale();
  const router = useRouter();
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2200);
  }, []);

  const copyText = async (labelKey: "admin.labelManage" | "admin.labelVote", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("admin.copied", { label: t(labelKey) }));
    } catch {
      toast(t("admin.copyFail"));
    }
  };

  const deleteRow = async (row: AdminMatchRow) => {
    if (!confirm(t("admin.confirmDelete", { title: row.title }))) {
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
        toast(j.error ? friendlyApiError(String(j.error), t) : t("admin.deleteFail"));
        return;
      }
      toast(t("admin.deleted"));
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
              <th className="px-3 py-3">{t("admin.thTitle")}</th>
              <th className="px-3 py-3">{t("admin.thSlug")}</th>
              <th className="px-3 py-3">{t("admin.thStatus")}</th>
              <th className="px-3 py-3 text-right">{t("admin.thImages")}</th>
              <th className="px-3 py-3 text-right">{t("admin.thVotes")}</th>
              <th className="px-3 py-3 text-right">{t("admin.thViews")}</th>
              <th className="px-3 py-3">{t("admin.thManage")}</th>
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
                  <td className="px-3 py-2.5 text-xs">{matchStatusDisplay(t, m.status)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{m.image_count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.vote_count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{m.view_count}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                      <Link href={managePath} className="text-cyan-300/90 underline hover:text-cyan-200">
                        {t("admin.openManage")}
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        className="!h-8 !min-h-0 !px-2.5 !py-1 !text-[11px]"
                        disabled={busy}
                        onClick={() => void copyText("admin.labelManage", manageAbs)}
                      >
                        {t("admin.copyManage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="!h-8 !min-h-0 !px-2.5 !py-1 !text-[11px]"
                        disabled={busy}
                        onClick={() => void copyText("admin.labelVote", voteAbs)}
                      >
                        {t("admin.copyVote")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="!h-8 !min-h-0 !px-2.5 !py-1 !text-[11px]"
                        disabled={busy}
                        onClick={() => void deleteRow(m)}
                      >
                        {busy ? t("admin.deleting") : t("admin.delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/45">{t("admin.emptyList")}</p>
        ) : null}
      </div>
    </div>
  );
}
