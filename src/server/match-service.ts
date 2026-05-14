import { randomBytes } from "crypto";
import { customAlphabet } from "nanoid";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/ip";

const slugAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export type MatchStatus = "draft" | "active" | "paused" | "ended";

export type MatchRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  status: MatchStatus;
  is_public: boolean;
  allow_anonymous: boolean;
  realtime_leaderboard: boolean;
  show_rating_history: boolean;
  created_ip_region: string | null;
  vote_count: number;
  view_count: number;
  created_at: string;
};

export type ImageRow = {
  id: string;
  match_id: string;
  image_url: string;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  elo_rating: number;
  battle_count: number;
  win_count: number;
  loss_count: number;
};

const VOTE_RATE_WINDOW_MS = 60_000;
const VOTE_RATE_MAX = 20;

async function generateUniqueSlug(): Promise<string> {
  const admin = createAdminClient();
  for (let i = 0; i < 8; i++) {
    const slug = slugAlphabet();
    const { data } = await admin.from("matches").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
  throw new Error("Could not allocate slug");
}

export async function createMatch(input: {
  title: string;
  description?: string;
  isPublic?: boolean;
  allowAnonymous?: boolean;
  realtimeLeaderboard?: boolean;
  showRatingHistory?: boolean;
  clientIp: string | null;
  region: string;
}): Promise<{ slug: string; manageToken: string; id: string }> {
  const admin = createAdminClient();
  const slug = await generateUniqueSlug();
  const manageToken = randomBytes(24).toString("hex");
  const { data, error } = await admin
    .from("matches")
    .insert({
      slug,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      is_public: input.isPublic ?? true,
      allow_anonymous: input.allowAnonymous ?? true,
      realtime_leaderboard: input.realtimeLeaderboard ?? true,
      show_rating_history: input.showRatingHistory ?? true,
      status: "draft",
      created_ip_region: input.region,
      creator_ip_hash: hashIp(input.clientIp),
      manage_token: manageToken,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  return { slug, manageToken, id: data.id };
}

export async function uploadImageToImgbb(base64: string, filename?: string) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error("Missing IMGBB_API_KEY");
  const params = new URLSearchParams();
  params.set("image", base64);
  if (filename) params.set("name", filename);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { url: string; display_url?: string; thumb?: { url?: string }; width?: number; height?: number };
    error?: { message?: string };
  };
  if (!json.success || !json.data?.url) {
    throw new Error(json.error?.message ?? "imgbb upload failed");
  }
  return {
    url: json.data.url,
    thumb: json.data.thumb?.url ?? json.data.display_url ?? json.data.url,
    width: json.data.width ?? null,
    height: json.data.height ?? null,
  };
}

export async function addImageToMatch(input: {
  matchId: string;
  manageToken: string;
  imageUrl: string;
  thumbUrl: string;
  width?: number | null;
  height?: number | null;
  contentHash?: string | null;
}): Promise<ImageRow> {
  const admin = createAdminClient();
  const { data: match, error: mErr } = await admin
    .from("matches")
    .select("id, manage_token, cover_image")
    .eq("id", input.matchId)
    .single();
  if (mErr || !match || match.manage_token !== input.manageToken) {
    throw new Error("Unauthorized");
  }
  const { count } = await admin
    .from("images")
    .select("*", { count: "exact", head: true })
    .eq("match_id", input.matchId);
  if ((count ?? 0) >= 10) throw new Error("Max 10 images");

  const { data: img, error } = await admin
    .from("images")
    .insert({
      match_id: input.matchId,
      image_url: input.imageUrl,
      thumb_url: input.thumbUrl,
      width: input.width ?? null,
      height: input.height ?? null,
      content_hash: input.contentHash ?? null,
      sort_order: count ?? 0,
    })
    .select("*")
    .single();
  if (error || !img) throw new Error(error?.message ?? "insert image failed");

  if (!match.cover_image) {
    await admin.from("matches").update({ cover_image: input.thumbUrl ?? input.imageUrl }).eq("id", input.matchId);
  }
  return img as ImageRow;
}

export async function activateMatch(matchId: string, manageToken: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, manage_token, status").eq("id", matchId).single();
  if (!match || match.manage_token !== manageToken) throw new Error("Unauthorized");
  const { count } = await admin.from("images").select("*", { count: "exact", head: true }).eq("match_id", matchId);
  if ((count ?? 0) < 2) throw new Error("Need at least 2 images");
  const { data: updated, error } = await admin
    .from("matches")
    .update({ status: "active" })
    .eq("id", matchId)
    .in("status", ["draft", "paused"])
    .select("status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated || updated.status !== "active") {
    throw new Error("Cannot activate from current state");
  }
}

export async function updateMatchBySlug(
  slug: string,
  manageToken: string,
  patch: Partial<{
    status: MatchStatus;
    title: string;
    description: string | null;
    is_public: boolean;
  }>
) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, manage_token").eq("slug", slug).single();
  if (!match || match.manage_token !== manageToken) throw new Error("Unauthorized");
  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;
  if (Object.keys(cleaned).length === 0) return;
  const { error } = await admin.from("matches").update(cleaned).eq("id", match.id);
  if (error) throw new Error(error.message);
}

export async function deleteMatch(slug: string, manageToken: string) {
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("id, manage_token").eq("slug", slug).single();
  if (!match || match.manage_token !== manageToken) throw new Error("Unauthorized");
  const { error } = await admin.from("matches").delete().eq("id", match.id);
  if (error) throw new Error(error.message);
}

export async function deleteImageFromMatch(slug: string, imageId: string, manageToken: string) {
  const admin = createAdminClient();
  const { data: match } = await admin
    .from("matches")
    .select("id, manage_token, status, cover_image")
    .eq("slug", slug)
    .single();
  if (!match || match.manage_token !== manageToken) throw new Error("Unauthorized");
  const { data: img } = await admin
    .from("images")
    .select("id")
    .eq("id", imageId)
    .eq("match_id", match.id)
    .maybeSingle();
  if (!img) throw new Error("Image not found");
  const { error: delErr } = await admin.from("images").delete().eq("id", imageId);
  if (delErr) throw new Error(delErr.message);

  const { count } = await admin.from("images").select("*", { count: "exact", head: true }).eq("match_id", match.id);
  const remaining = count ?? 0;
  if (remaining < 2 && match.status === "active") {
    await admin.from("matches").update({ status: "paused" }).eq("id", match.id);
  }
  const { data: first } = await admin
    .from("images")
    .select("thumb_url, image_url")
    .eq("match_id", match.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  const cover = first ? first.thumb_url ?? first.image_url : null;
  await admin.from("matches").update({ cover_image: cover }).eq("id", match.id);
}

export async function getMatchForPublic(slug: string, opts?: { manageToken?: string }): Promise<{
  match: MatchRow;
  images: ImageRow[];
} | null> {
  const admin = createAdminClient();
  const { data: match, error } = await admin.from("matches").select("*").eq("slug", slug).single();
  if (error || !match) return null;
  if (match.status === "draft" && opts?.manageToken !== match.manage_token) return null;
  const { data: images, error: iErr } = await admin
    .from("images")
    .select("*")
    .eq("match_id", match.id)
    .order("sort_order", { ascending: true });
  if (iErr) throw new Error(iErr.message);
  return { match: match as MatchRow, images: (images ?? []) as ImageRow[] };
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getNextPair(slug: string): Promise<{
  left: ImageRow;
  right: ImageRow;
} | null> {
  const admin = createAdminClient();
  const bundle = await getMatchForPublic(slug);
  if (!bundle || bundle.match.status !== "active") return null;
  const imgs = bundle.images;
  if (imgs.length < 2) return null;

  const pairs: { a: string; b: string; key: string }[] = [];
  for (let i = 0; i < imgs.length; i++) {
    for (let j = i + 1; j < imgs.length; j++) {
      const [a, b] = orderedPair(imgs[i].id, imgs[j].id);
      pairs.push({ a, b, key: `${a}:${b}` });
    }
  }

  const { data: stats } = await admin
    .from("pair_encounters")
    .select("image_a_id, image_b_id, encounter_count")
    .eq("match_id", bundle.match.id);

  const map = new Map<string, number>();
  for (const s of stats ?? []) {
    map.set(`${s.image_a_id}:${s.image_b_id}`, s.encounter_count ?? 0);
  }

  let best = Number.POSITIVE_INFINITY;
  for (const p of pairs) {
    const c = map.get(p.key) ?? 0;
    if (c < best) best = c;
  }
  const candidates = pairs.filter((p) => (map.get(p.key) ?? 0) === best);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const [low, high] = [pick.a, pick.b];

  const { data: existing } = await admin
    .from("pair_encounters")
    .select("id, encounter_count")
    .eq("match_id", bundle.match.id)
    .eq("image_a_id", low)
    .eq("image_b_id", high)
    .maybeSingle();

  if (existing) {
    await admin
      .from("pair_encounters")
      .update({ encounter_count: (existing.encounter_count ?? 0) + 1 })
      .eq("id", existing.id);
  } else {
    await admin.from("pair_encounters").insert({
      match_id: bundle.match.id,
      image_a_id: low,
      image_b_id: high,
      encounter_count: 1,
    });
  }

  const leftFirst = Math.random() < 0.5;
  const left = imgs.find((i) => i.id === (leftFirst ? low : high))!;
  const right = imgs.find((i) => i.id === (leftFirst ? high : low))!;
  return { left, right };
}

export async function assertVoteRateOk(matchId: string, voterHash: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - VOTE_RATE_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("battles")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("voter_ip_hash", voterHash)
    .eq("skipped", false)
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= VOTE_RATE_MAX) throw new Error("Rate limited");
}

export async function submitVote(input: {
  slug: string;
  winnerId: string;
  loserId: string;
  leftId: string;
  rightId: string;
  voterHash: string;
  region: string;
}) {
  const admin = createAdminClient();
  const bundle = await getMatchForPublic(input.slug);
  if (!bundle) throw new Error("Match not found");
  if (bundle.match.status !== "active") throw new Error("Match not active");
  const ids = new Set(bundle.images.map((i) => i.id));
  if (!ids.has(input.winnerId) || !ids.has(input.loserId)) throw new Error("Invalid images");
  if (input.winnerId === input.loserId) throw new Error("Invalid pair");

  await assertVoteRateOk(bundle.match.id, input.voterHash);

  const { data, error } = await admin.rpc("apply_match_vote", {
    p_match_id: bundle.match.id,
    p_winner_id: input.winnerId,
    p_loser_id: input.loserId,
    p_left_id: input.leftId,
    p_right_id: input.rightId,
    p_voter_hash: input.voterHash,
    p_voter_region: input.region,
    p_k: 32,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function submitSkip(input: {
  slug: string;
  leftId: string;
  rightId: string;
  voterHash: string;
  region: string;
}) {
  const admin = createAdminClient();
  const bundle = await getMatchForPublic(input.slug);
  if (!bundle) throw new Error("Match not found");
  if (bundle.match.status !== "active") throw new Error("Match not active");
  const { error } = await admin.from("battles").insert({
    match_id: bundle.match.id,
    left_image_id: input.leftId,
    right_image_id: input.rightId,
    winner_image_id: null,
    loser_image_id: null,
    voter_ip_hash: input.voterHash,
    voter_region: input.region,
    skipped: true,
  });
  if (error) throw new Error(error.message);
}

export async function incrementViewCount(slug: string) {
  const admin = createAdminClient();
  const { data: m } = await admin.from("matches").select("id, view_count").eq("slug", slug).single();
  if (!m) return;
  await admin
    .from("matches")
    .update({ view_count: (m.view_count ?? 0) + 1 })
    .eq("id", m.id);
}

export async function getRankings(slug: string) {
  const bundle = await getMatchForPublic(slug);
  if (!bundle) return null;
  const ranked = [...bundle.images].sort((a, b) => b.elo_rating - a.elo_rating);
  return ranked.map((img, idx) => ({
    rank: idx + 1,
    image: img,
    winRate: img.battle_count > 0 ? img.win_count / img.battle_count : 0,
  }));
}

export async function listMatchesHome(): Promise<
  {
    match: MatchRow;
    votes24h: number;
    activeVoters: number;
    hotScore: number;
    hotScoreAlt: number;
  }[]
> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tenAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: matches, error } = await admin
    .from("matches")
    .select("*")
    .eq("is_public", true)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (error || !matches?.length) return [];

  const ids = matches.map((m) => m.id);

  const { data: battlesDay } = await admin
    .from("battles")
    .select("match_id, voter_ip_hash, created_at, skipped")
    .in("match_id", ids)
    .gte("created_at", dayAgo);

  const { data: battles10 } = await admin
    .from("battles")
    .select("match_id, voter_ip_hash")
    .in("match_id", ids)
    .gte("created_at", tenAgo);

  const votes24 = new Map<string, number>();
  const voters10 = new Map<string, Set<string>>();

  for (const b of battlesDay ?? []) {
    if (b.skipped) continue;
    votes24.set(b.match_id, (votes24.get(b.match_id) ?? 0) + 1);
  }
  for (const b of battles10 ?? []) {
    if (!voters10.has(b.match_id)) voters10.set(b.match_id, new Set());
    voters10.get(b.match_id)!.add(b.voter_ip_hash);
  }

  return matches.map((m) => {
    const v24 = votes24.get(m.id) ?? 0;
    const online = voters10.get(m.id)?.size ?? 0;
    const views = m.view_count ?? 0;
    const hotScore = v24 * 0.5 + online * 0.3 + views * 0.2;
    const hotScoreAlt = v24 * 0.7 + online * 0.3;
    return { match: m as MatchRow, votes24h: v24, activeVoters: online, hotScore, hotScoreAlt };
  });
}

export async function ratingHistoryForMatch(slug: string, limit = 500) {
  const bundle = await getMatchForPublic(slug);
  if (!bundle?.match.show_rating_history) return [];
  const admin = createAdminClient();
  const imageIds = bundle.images.map((i) => i.id);
  if (!imageIds.length) return [];
  const { data, error } = await admin
    .from("rating_history")
    .select("image_id, old_rating, new_rating, created_at")
    .in("image_id", imageIds)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recentVoteRegions(slug: string, limit = 30) {
  const bundle = await getMatchForPublic(slug);
  if (!bundle) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("battles")
    .select("voter_region, created_at, skipped")
    .eq("match_id", bundle.match.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).filter((b) => !b.skipped);
}
