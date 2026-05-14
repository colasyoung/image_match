import { z } from "zod";

export const createMatchSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  realtimeLeaderboard: z.boolean().optional(),
  showRatingHistory: z.boolean().optional(),
});

const createQueueFileEntry = z.object({ type: z.literal("file"), slot: z.number().int().min(0).max(499) });
const createQueueUrlEntry = z.object({ type: z.literal("url"), url: z.string().url().max(4096) });

/** multipart 字段 `payload`（JSON 字符串） */
export const createMatchMultipartPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  queue: z
    .array(z.discriminatedUnion("type", [createQueueFileEntry, createQueueUrlEntry]))
    .min(2)
    .max(500),
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
