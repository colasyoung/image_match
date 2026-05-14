import { NextResponse } from "next/server";
import { deleteImageFromMatch } from "@/server/match-service";

type Params = { params: Promise<{ slug: string; imageId: string }> };

export async function DELETE(req: Request, ctx: Params) {
  const { slug, imageId } = await ctx.params;
  const token =
    new URL(req.url).searchParams.get("token") ?? req.headers.get("x-manage-token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  try {
    await deleteImageFromMatch(slug, imageId, token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
