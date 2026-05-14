import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AdminMatchesTable, type AdminMatchRow } from "@/components/AdminMatchesTable";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "总站管理",
  robots: { index: false, follow: false },
};

type MatchQueryRow = {
  slug: string;
  title: string;
  status: string;
  manage_token: string;
  vote_count: number | null;
  view_count: number | null;
  created_at: string;
  images?: { count?: number }[] | null;
};

function imageCountFromRow(m: MatchQueryRow): number {
  const arr = m.images;
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const c = arr[0]?.count;
  return typeof c === "number" ? c : 0;
}

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
    .select("slug, title, status, manage_token, vote_count, view_count, created_at, images(count)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-red-300">
        读取失败：{error.message}
      </div>
    );
  }

  const raw = (data ?? []) as MatchQueryRow[];
  const rows: AdminMatchRow[] = raw.map((m) => ({
    slug: m.slug,
    title: m.title,
    status: m.status,
    manage_token: m.manage_token,
    vote_count: m.vote_count ?? 0,
    view_count: m.view_count ?? 0,
    image_count: imageCountFromRow(m),
    created_at: m.created_at,
  }));

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold text-white">总站管理</h1>
        <p className="mt-2 text-sm text-amber-200/90">
          仅部署者使用：请勿公开此页面的完整 URL（含 key）。每个比赛仍依赖各自的 manage_token；此处只是集中列出链接与数据。
        </p>
        <p className="mt-1 text-xs text-white/45">
          单个比赛管理页路径：<code className="text-cyan-200/90">/manage/&lt;slug&gt;?token=&lt;token&gt;</code>
          ，公开投票页：<code className="text-cyan-200/90">/m/&lt;slug&gt;</code>
        </p>
      </div>

      <AdminMatchesTable rows={rows} origin={origin} />

      <p className="text-xs text-white/35">
        提示：在 Vercel / 本地 `.env.local` 中设置 `MASTER_ADMIN_SECRET`（足够长的随机串），访问{" "}
        <code className="text-white/55">/admin?key=该值</code>。
        <span className="mt-1 block text-white/30">
          「浏览」为投票页累计打开次数（与票数不同）；「图片」为当前图库张数。
        </span>
      </p>
    </div>
  );
}
