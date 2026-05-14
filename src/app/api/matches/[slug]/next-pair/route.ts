import { NextResponse } from "next/server";
import { getNextPair } from "@/server/match-service";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  try {
    const pair = await getNextPair(slug);
    if (!pair) return NextResponse.json({ error: "No duel available" }, { status: 404 });
    return NextResponse.json({
      left: pair.left,
      right: pair.right,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
