import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "总站管理",
  robots: { index: false, follow: false },
};

type MatchRow = {
  slug: string;
  title: string;
  status: string;
  manage_token: string;
  vote_count: number | null;
  created_at: string;
};

export default async function MasterAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const secret = process.env.MASTER_ADMIN_SECRET;
  if (!secret || key !== secret) {
    notFound();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("matches")
    .select("slug, title, status, manage_token, vote_count, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-red-300">
        读取失败：{error.message}
      </div>
    );
  }

  const rows = (data ?? []) as MatchRow[];
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold text-white">总站管理</h1>
        <p className="mt-2 text-sm text-amber-200/90">
          仅部署者使用：请勿公开此页面的完整 URL（含 key）。每个比赛仍依赖各自的 manage_token；此处只是集中列出链接。
        </p>
        <p className="mt-1 text-xs text-white/45">
          单个比赛管理页路径：<code className="text-cyan-200/90">/manage/&lt;slug&gt;?token=&lt;token&gt;</code>
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-3 py-3">标题</th>
              <th className="px-3 py-3">slug</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-3 py-3">票数</th>
              <th className="px-3 py-3">管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((m) => {
              const path = `/manage/${encodeURIComponent(m.slug)}?token=${encodeURIComponent(m.manage_token)}`;
              const href = origin ? `${origin}${path}` : path;
              return (
                <tr key={m.slug} className="text-white/85">
                  <td className="max-w-[200px] truncate px-3 py-2.5 font-medium">{m.title}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-white/60">{m.slug}</td>
                  <td className="px-3 py-2.5 text-xs">{m.status}</td>
                  <td className="px-3 py-2.5 tabular-nums">{m.vote_count ?? 0}</td>
                  <td className="px-3 py-2.5">
                    <Link href={path} className="text-cyan-300/90 underline hover:text-cyan-200">
                      打开
                    </Link>
                    <span className="mx-2 text-white/25">|</span>
                    <span className="break-all font-mono text-[10px] text-white/40" title={href}>
                      {href.length > 72 ? `${href.slice(0, 40)}…${href.slice(-24)}` : href}
                    </span>
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

      <p className="text-xs text-white/35">
        提示：在 Vercel / 本地 `.env.local` 中设置 `MASTER_ADMIN_SECRET`（足够长的随机串），访问{" "}
        <code className="text-white/55">/admin?key=该值</code>。
      </p>
    </div>
  );
}
