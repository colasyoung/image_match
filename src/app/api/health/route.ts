import { NextResponse } from "next/server";

/** 用于托管商 / 监控探活（Worker、Vercel 均可 GET） */
export async function GET() {
  return NextResponse.json({ ok: true, service: "image-match" });
}
