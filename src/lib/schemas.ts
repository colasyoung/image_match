import { z } from "zod";

export const createMatchSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  realtimeLeaderboard: z.boolean().optional(),
  showRatingHistory: z.boolean().optional(),
});

export const voteSchema = z.object({
  slug: z.string().min(1),
  winnerId: z.string().uuid(),
  loserId: z.string().uuid(),
  leftId: z.string().uuid(),
  rightId: z.string().uuid(),
});

export const skipSchema = z.object({
  slug: z.string().min(1),
  leftId: z.string().uuid(),
  rightId: z.string().uuid(),
});
