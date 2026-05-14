import { NextResponse } from "next/server";
import { createMatchSchema } from "@/lib/schemas";
import { clientIpFromHeaders, regionFromHeaders } from "@/lib/ip";
import { createMatch } from "@/server/match-service";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = createMatchSchema.parse(json);
    const headers = req.headers;
    const result = await createMatch({
      ...body,
      clientIp: clientIpFromHeaders(headers),
      region: regionFromHeaders(headers),
    });
    return NextResponse.json({
      slug: result.slug,
      manageToken: result.manageToken,
      id: result.id,
      publicUrl: `/m/${result.slug}`,
      manageUrl: `/manage/${result.slug}?token=${result.manageToken}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
