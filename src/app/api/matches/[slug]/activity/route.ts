import { NextResponse } from "next/server";
import { getActivityFeed } from "@/server/match-service";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  try {
    const data = await getActivityFeed(slug);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
