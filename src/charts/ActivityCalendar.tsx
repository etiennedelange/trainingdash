import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useEChart } from "./useEChart";

export function ActivityCalendar({ days, year }: { days: string[]; year: number }) {
  const option = useMemo<EChartsOption>(() => {
    const counts = new Map<string, number>();
    for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
    const data = [...counts.entries()].filter(([d]) => d.startsWith(String(year)));

    return {
      tooltip: { formatter: (p) => `${(p as unknown as { data: [string, number] }).data[0]}` },
      visualMap: {
        show: false,
        min: 0,
        max: 3,
        inRange: { color: ["#141b23", "#0e9488", "#2dd4bf"] },
      },
      calendar: {
        range: String(year),
        cellSize: [14, 14],
        left: 40,
        right: 10,
        itemStyle: { color: "#0e141b", borderColor: "#0b0f14", borderWidth: 2 },
        splitLine: { show: false },
        yearLabel: { show: false },
        dayLabel: { color: "#5b6472", fontSize: 10 },
        monthLabel: { color: "#8792a0", fontSize: 10 },
      },
      series: [{ type: "heatmap", coordinateSystem: "calendar", data }],
    };
  }, [days, year]);

  const ref = useEChart(option);
  return <div ref={ref} className="h-[180px] w-full" />;
}
