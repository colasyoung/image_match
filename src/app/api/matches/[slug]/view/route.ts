import { NextResponse } from "next/server";
import { incrementViewCount } from "@/server/match-service";

type Params = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  try {
    await incrementViewCount(slug);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
