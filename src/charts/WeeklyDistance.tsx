import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { WeekBucket } from "#shared/aggregate";
import { useEChart } from "./useEChart";
import { cssVar, useTheme } from "@/hooks/useTheme";

export function WeeklyDistance({
  buckets,
  averageDistance,
  goalKm,
}: {
  buckets: WeekBucket[];
  averageDistance?: number;
  goalKm?: number | null;
}) {
  const [theme] = useTheme();
  const option = useMemo<EChartsOption>(() => {
    const line = cssVar("--color-raised");
    const label = cssVar("--color-faint");
    const accent = cssVar("--color-accent");
    const faint = cssVar("--color-faint");

    const markLines = [];
    if (averageDistance !== undefined) {
      markLines.push({
        yAxis: averageDistance,
        lineStyle: { color: faint, type: "dashed" as const },
        label: {
          color: faint,
          fontSize: 10,
          formatter: () => `avg ${(averageDistance / 1000).toFixed(1)}k`,
        },
      });
    }
    if (goalKm) {
      markLines.push({
        yAxis: goalKm * 1000,
        lineStyle: { color: accent, type: "dashed" as const },
        label: {
          color: accent,
          fontSize: 10,
          formatter: () => `goal ${goalKm}k`,
        },
      });
    }

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
          markLine:
            markLines.length > 0
              ? { symbol: "none", silent: true, data: markLines }
              : undefined,
        },
      ],
    };
    // theme is read for its side effect: it forces this memo (and the CSS
    // var reads above) to recompute when the ThemeToggle flips data-theme.
  }, [buckets, averageDistance, goalKm, theme]);

  const ref = useEChart(option);
  return <div ref={ref} className="h-[220px] w-full" />;
}
