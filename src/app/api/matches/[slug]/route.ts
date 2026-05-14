import { NextResponse } from "next/server";
import { z } from "zod";
import {
  activateMatch,
  deleteMatch,
  getMatchForPublic,
  recentVoteRegions,
  ratingHistoryForMatch,
  updateMatchBySlug,
} from "@/server/match-service";

type Params = { params: Promise<{ slug: string }> };

function publicMatch(match: Record<string, unknown>) {
  const rest = { ...match };
  delete rest.manage_token;
  return rest;
}

export async function GET(req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") ?? req.headers.get("x-manage-token") ?? undefined;
  try {
    const bundle = await getMatchForPublic(slug, { manageToken: token });
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const history = bundle.match.show_rating_history ? await ratingHistoryForMatch(slug) : [];
    const regions = await recentVoteRegions(slug);
    return NextResponse.json({
      match: publicMatch(bundle.match as unknown as Record<string, unknown>),
      images: bundle.images,
      ratingHistory: history,
      recentRegions: regions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const patchSchema = z.object({
  token: z.string().min(10),
  status: z.enum(["draft", "active", "paused", "ended"]).optional(),
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  is_public: z.boolean().optional(),
  activate: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  try {
    const json = await req.json();
    const body = patchSchema.parse(json);
    const bundle = await getMatchForPublic(slug, { manageToken: body.token });
    if (!bundle || (bundle.match as { manage_token?: string }).manage_token !== body.token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (body.activate) {
      await activateMatch(bundle.match.id, body.token);
      return NextResponse.json({ ok: true });
    }
    const patch: {
      status?: (typeof body)["status"];
      title?: string;
      description?: string | null;
      is_public?: boolean;
    } = {};
    if (body.status !== undefined) patch.status = body.status;
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.is_public !== undefined) patch.is_public = body.is_public;
    if (Object.keys(patch).length) {
      await updateMatchBySlug(slug, body.token, patch);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

const deleteSchema = z.object({ token: z.string().min(10) });

export async function DELETE(req: Request, ctx: Params) {
  const { slug } = await ctx.params;
  try {
    const json = await req.json();
    const body = deleteSchema.parse(json);
    await deleteMatch(slug, body.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
