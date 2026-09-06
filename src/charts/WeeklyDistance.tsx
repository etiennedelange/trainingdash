import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { WeekBucket } from "#shared/aggregate";
import { useEChart } from "./useEChart";

export function WeeklyDistance({ buckets }: { buckets: WeekBucket[] }) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => `${((v as number) / 1000).toFixed(1)} km`,
      },
      xAxis: {
        type: "category",
        data: buckets.map((b) => b.weekStart.slice(5)),
        axisLine: { lineStyle: { color: "#1d2530" } },
        axisLabel: { color: "#5b6472", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#1d2530" } },
        axisLabel: {
          color: "#5b6472",
          fontSize: 10,
          formatter: (v: number) => `${v / 1000}k`,
        },
      },
      series: [
        {
          type: "bar",
          data: buckets.map((b) => b.distance),
          itemStyle: { color: "#2dd4bf", borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [buckets],
  );

  const ref = useEChart(option);
  return <div ref={ref} className="h-[220px] w-full" />;
}
