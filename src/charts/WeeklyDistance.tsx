import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { WeekBucket } from "#shared/aggregate";
import { useEChart } from "./useEChart";
import { cssVar, useTheme } from "@/hooks/useTheme";

export function WeeklyDistance({ buckets }: { buckets: WeekBucket[] }) {
  const [theme] = useTheme();
  const option = useMemo<EChartsOption>(() => {
    const line = cssVar("--color-raised");
    const label = cssVar("--color-faint");
    const accent = cssVar("--color-accent");

    return {
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => `${((v as number) / 1000).toFixed(1)} km`,
      },
      xAxis: {
        type: "category",
        data: buckets.map((b) => b.weekStart.slice(5)),
        axisLine: { lineStyle: { color: line } },
        axisLabel: { color: label, fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: line } },
        axisLabel: {
          color: label,
          fontSize: 10,
          formatter: (v: number) => `${v / 1000}k`,
        },
      },
      series: [
        {
          type: "bar",
          data: buckets.map((b) => b.distance),
          itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
    // theme is read for its side effect: it forces this memo (and the CSS
    // var reads above) to recompute when the ThemeToggle flips data-theme.
  }, [buckets, theme]);

  const ref = useEChart(option);
  return <div ref={ref} className="h-[220px] w-full" />;
}
