import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useEChart } from "./useEChart";
import { cssVar, useTheme } from "@/hooks/useTheme";

export function ActivityCalendar({ days, year }: { days: string[]; year: number }) {
  const [theme] = useTheme();
  const option = useMemo<EChartsOption>(() => {
    const counts = new Map<string, number>();
    for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
    const data = [...counts.entries()].filter(([d]) => d.startsWith(String(year)));

    const card = cssVar("--color-card");
    const surface = cssVar("--color-surface");
    const accentDeep = cssVar("--color-accent-deep");
    const accent = cssVar("--color-accent");
    const faint = cssVar("--color-faint");
    const muted = cssVar("--color-muted");

    return {
      tooltip: { formatter: (p) => `${(p as unknown as { data: [string, number] }).data[0]}` },
      visualMap: {
        show: false,
        min: 0,
        max: 3,
        inRange: { color: [card, accentDeep, accent] },
      },
      calendar: {
        range: String(year),
        cellSize: [14, 14],
        left: 40,
        right: 10,
        itemStyle: { color: surface, borderColor: cssVar("--color-ground"), borderWidth: 2 },
        splitLine: { show: false },
        yearLabel: { show: false },
        dayLabel: { color: faint, fontSize: 10 },
        monthLabel: { color: muted, fontSize: 10 },
      },
      series: [{ type: "heatmap", coordinateSystem: "calendar", data }],
    };
    // theme is read for its side effect: it forces this memo (and the CSS
    // var reads above) to recompute when the ThemeToggle flips data-theme.
  }, [days, year, theme]);

  const ref = useEChart(option);
  return <div ref={ref} className="h-[180px] w-full" />;
}
