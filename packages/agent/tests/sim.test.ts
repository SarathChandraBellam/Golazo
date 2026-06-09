import { beforeAll, describe, expect, it } from "vitest";
import { ensureData } from "../src/data/loader.js";
import { computeStrengths, findStrength, shootoutConversionRate } from "../src/sim/strengths.js";
import { simulateMatch, simulateTournament } from "../src/sim/simulate.js";

beforeAll(async () => {
  await ensureData();
});

describe("strength model", () => {
  it("rates Brazil's attack above average and above minnows", () => {
    const model = computeStrengths("men");
    const brazil = findStrength(model, "Brazil")!;
    expect(brazil.attack).toBeGreaterThan(1);
    expect(brazil.matches).toBeGreaterThan(100);
  });

  it("shootout conversion rate is plausible", () => {
    const rate = shootoutConversionRate();
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.85);
  });
});

describe("match simulation", () => {
  it("probabilities sum to ~1 and favour Brazil over a weaker side", () => {
    const res = simulateMatch({ team1: "Brazil", team2: "Bolivia", seed: 1 });
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    const { team1_win, draw, team2_win } = res.probabilities;
    expect(team1_win + draw + team2_win).toBeCloseTo(1, 5);
    expect(team1_win).toBeGreaterThan(team2_win);
    expect(team1_win).toBeGreaterThan(0.5);
  });

  it("knockout mode resolves every game (advance sums to ~1)", () => {
    const res = simulateMatch({
      team1: "Argentina",
      team2: "France",
      knockout: true,
      seed: 2,
    });
    if ("error" in res) throw new Error(res.error);
    expect(res.advance).toBeDefined();
    expect(res.advance!.team1 + res.advance!.team2).toBeCloseTo(1, 5);
  });

  it("is deterministic for a fixed seed", () => {
    const a = simulateMatch({ team1: "Spain", team2: "Italy", seed: 7 });
    const b = simulateMatch({ team1: "Spain", team2: "Italy", seed: 7 });
    expect(a).toEqual(b);
  });

  it("errors cleanly on unknown teams", () => {
    const res = simulateMatch({ team1: "Brazil", team2: "Narnia" });
    expect(res).toHaveProperty("error");
  });
});

describe("tournament simulation", () => {
  it("simulates an 8-team bracket with sane champion probabilities", () => {
    const res = simulateTournament({
      teams: ["Brazil", "Germany", "Argentina", "France", "Spain", "England", "Italy", "Netherlands"],
      seed: 3,
    });
    if ("error" in res) throw new Error(res.error);
    const total = res.champion_probabilities.reduce((s, c) => s + c.probability, 0);
    expect(total).toBeCloseTo(1, 1);
    expect(res.sample_run.at(-1)?.round).toBe("final");
    expect(res.champion_probabilities[0].probability).toBeLessThan(0.6);
  });

  it("rejects invalid bracket sizes", () => {
    const res = simulateTournament({ teams: ["Brazil", "Germany", "France"] });
    expect(res).toHaveProperty("error");
  });
});
