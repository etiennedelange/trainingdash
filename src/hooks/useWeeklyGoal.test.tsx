import { describe, it, expect, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { useWeeklyGoal } from "./useWeeklyGoal";

function Probe() {
  const [goal, setGoal] = useWeeklyGoal();
  return (
    <div>
      <span data-testid="goal">{goal === null ? "none" : String(goal)}</span>
      <button onClick={() => setGoal(30)}>set30</button>
      <button onClick={() => setGoal(null)}>clear</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe("useWeeklyGoal", () => {
  it("reads an existing goal from localStorage on mount", async () => {
    localStorage.setItem("trainingdash:weekly-goal-km", "25");
    await render(<Probe />);
    await expect.element(page.getByTestId("goal")).toHaveTextContent("25");
  });

  it("persists a goal when set", async () => {
    render(<Probe />);
    await page.getByText("set30").click();
    await expect.element(page.getByTestId("goal")).toHaveTextContent("30");
    expect(localStorage.getItem("trainingdash:weekly-goal-km")).toBe("30");
  });

  it("clears the goal and its storage entry", async () => {
    localStorage.setItem("trainingdash:weekly-goal-km", "25");
    render(<Probe />);
    await page.getByText("clear").click();
    await expect.element(page.getByTestId("goal")).toHaveTextContent("none");
    expect(localStorage.getItem("trainingdash:weekly-goal-km")).toBeNull();
  });
});