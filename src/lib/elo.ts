const K_DEFAULT = 32;

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export function nextRatings(
  winnerRating: number,
  loserRating: number,
  k: number = K_DEFAULT
): { winner: number; loser: number } {
  const ew = expectedScore(winnerRating, loserRating);
  const el = 1 - ew;
  return {
    winner: winnerRating + k * (1 - ew),
    loser: loserRating + k * (0 - el),
  };
}
