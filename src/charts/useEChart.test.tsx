import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { useEChart } from "./useEChart";

function Bars() {
  const ref = useEChart({
    xAxis: { type: "category", data: ["a", "b"] },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: [1, 2] }],
  });
  return <div ref={ref} data-testid="chart" style={{ width: 300, height: 200 }} />;
}

describe("useEChart", () => {
  it("mounts a canvas into the container", async () => {
    await render(<Bars />);
    const el = page.getByTestId("chart");
    await expect.element(el).toBeInTheDocument();
    await expect
      .poll(() => el.element().querySelector("canvas"))
      .toBeTruthy();
  });

  it("disposes cleanly on unmount", async () => {
    const { unmount } = await render(<Bars />);
    expect(() => unmount()).not.toThrow();
  });
});
