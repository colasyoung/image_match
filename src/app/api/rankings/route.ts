import { NextResponse } from "next/server";
import { getRankings } from "@/server/match-service";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  try {
    const rankings = await getRankings(slug);
    if (!rankings) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ rankings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
