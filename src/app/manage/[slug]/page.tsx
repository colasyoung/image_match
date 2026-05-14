import { Suspense } from "react";
import { ManageClient } from "./ManageClient";

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-center text-white/50">加载…</div>}>
      <ManageClient slug={slug} />
    </Suspense>
  );
}
