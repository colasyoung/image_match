import { NextResponse } from "next/server";
import { addImageToMatch, uploadImageToImgbb } from "@/server/match-service";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const matchId = String(form.get("matchId") ?? "");
    const manageToken = String(form.get("manageToken") ?? "");
    const file = form.get("file");
    if (!matchId || !manageToken || !(file instanceof Blob)) {
      return NextResponse.json({ error: "matchId, manageToken, file required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const name = (file as File).name || "upload";
    const uploaded = await uploadImageToImgbb(base64, name);
    const row = await addImageToMatch({
      matchId,
      manageToken,
      imageUrl: uploaded.url,
      thumbUrl: uploaded.thumb,
      width: uploaded.width,
      height: uploaded.height,
    });
    return NextResponse.json({ image: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
