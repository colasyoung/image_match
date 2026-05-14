import type { MatchStatus } from "@/server/match-service";

const LABEL_KEY: Record<MatchStatus, string> = {
  draft: "status.draftLabel",
  active: "status.activeLabel",
  paused: "status.pausedLabel",
  ended: "status.endedLabel",
};

/** 将 `matches.status` 显示为当前界面语言的短标签；未知值原样返回。 */
export function matchStatusDisplay(
  t: (path: string, vars?: Record<string, string | number | undefined>) => string,
  status: string
): string {
  const key = LABEL_KEY[status as MatchStatus];
  return key ? t(key) : status;
}
