import { NextResponse } from "next/server";
import { voteSchema, skipSchema } from "@/lib/schemas";
import { clientIpFromHeaders, hashIp, regionFromHeaders } from "@/lib/ip";
import { submitSkip, submitVote } from "@/server/match-service";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const headers = req.headers;
    const voterHash = hashIp(clientIpFromHeaders(headers));
    const region = regionFromHeaders(headers);

    if (json?.action === "skip") {
      const body = skipSchema.parse(json);
      await submitSkip({ ...body, voterHash, region });
      return NextResponse.json({ ok: true, skipped: true });
    }

    const body = voteSchema.parse(json);
    const data = await submitVote({ ...body, voterHash, region });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Vote failed";
    const status = msg.includes("Rate limited") ? 429 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
