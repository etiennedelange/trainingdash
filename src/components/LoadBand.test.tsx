import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { LoadBand } from "./LoadBand";
import type { Acwr } from "#shared/aggregate";

const acwr = (ratio: number): Acwr => ({
  acute: 3600,
  chronic: 3600,
  ratio,
  band: ratio < 0.8 ? "detraining" : ratio > 1.5 ? "spiking" : "steady",
});

describe("LoadBand", () => {
  it("renders the ratio and a steady label", async () => {
    render(<LoadBand acwr={acwr(1.0)} />);
    await expect.element(page.getByText("1.0")).toBeInTheDocument();
    await expect.element(page.getByText(/steady load/i)).toBeInTheDocument();
  });

  it("labels a spike", async () => {
    render(<LoadBand acwr={acwr(1.8)} />);
    await expect.element(page.getByText(/spiking/i)).toBeInTheDocument();
  });

  it("labels detraining", async () => {
    render(<LoadBand acwr={acwr(0.5)} />);
    await expect.element(page.getByText(/detraining/i)).toBeInTheDocument();
  });

  it("explains when there is not enough history", async () => {
    render(<LoadBand acwr={{ acute: 0, chronic: 0, ratio: null, band: null }} />);
    await expect.element(page.getByText(/28 days/i)).toBeInTheDocument();
  });
});