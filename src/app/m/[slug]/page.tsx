import { notFound } from "next/navigation";
import {
  getMatchForPublic,
  getRankings,
  ratingHistoryForMatch,
  recentVoteRegions,
} from "@/server/match-service";
import { MatchExperience } from "./MatchExperience";

type PageProps = { params: Promise<{ slug: string }> };

export default async function MatchPage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = await getMatchForPublic(slug);
  if (!bundle || bundle.match.status === "draft") notFound();
  const rankings = await getRankings(slug);
  if (!rankings) notFound();
  const ratingHistory = bundle.match.show_rating_history ? await ratingHistoryForMatch(slug) : [];
  const recentRegions = await recentVoteRegions(slug);

  return (
    <MatchExperience
      slug={slug}
      match={bundle.match}
      images={bundle.images}
      rankings={rankings}
      ratingHistory={ratingHistory}
      recentRegions={recentRegions}
    />
  );
}
