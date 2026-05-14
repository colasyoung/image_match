import { notFound } from "next/navigation";
import { getActivityFeed, getMatchForPublic, getRankings } from "@/server/match-service";
import { MatchExperience } from "./MatchExperience";

type PageProps = { params: Promise<{ slug: string }> };

export default async function MatchPage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = await getMatchForPublic(slug);
  if (!bundle || bundle.match.status === "draft") notFound();
  const rankings = await getRankings(slug);
  if (!rankings) notFound();
  const activity = (await getActivityFeed(slug)) ?? { items: [], regionCounts: {} };

  return (
    <MatchExperience
      slug={slug}
      match={bundle.match}
      rankings={rankings}
      activity={activity}
    />
  );
}
