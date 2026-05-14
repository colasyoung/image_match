"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const colors = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185"];

export function EloHistoryChart({
  history,
  imageIds,
}: {
  history: { image_id: string; old_rating: number; new_rating: number; created_at: string }[];
  imageIds: string[];
}) {
  const data = useMemo(() => {
    const showIds = imageIds.slice(0, 6);
    const state: Record<string, number> = Object.fromEntries(showIds.map((id) => [id, 1200]));
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const rows: Record<string, number | string>[] = [];
    let tick = 0;
    for (const h of sorted) {
      state[h.image_id] = h.new_rating;
      const row: Record<string, number | string> = {
        tick: tick++,
        label: new Date(h.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      };
      for (const id of showIds) {
        row[`e_${id.slice(0, 8)}`] = state[id] ?? 1200;
      }
      rows.push(row);
    }
    return { rows, showIds };
  }, [history, imageIds]);

  if (!history.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/50">
        暂无评分历史（开始投票后会生成曲线）
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="tick" hide />
          <YAxis width={36} stroke="rgba(255,255,255,0.35)" fontSize={11} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          />
          {data.showIds.map((id, j) => (
            <Line
              key={id}
              type="monotone"
              dataKey={`e_${id.slice(0, 8)}`}
              name={id.slice(0, 6)}
              stroke={colors[j % colors.length]}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
