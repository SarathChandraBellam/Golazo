import { beforeAll, describe, expect, it } from "vitest";
import { ensureData } from "../src/data/loader.js";
import {
  getTournamentStandings,
  listAwardWinners,
  listTournaments,
} from "../src/tools/tournaments.js";
import { getPlayerStats, topGoalScorers } from "../src/tools/players.js";
import { findMatches, getTeamRecord, headToHead } from "../src/tools/matches.js";
import type { ToolResult } from "../src/tools/helpers.js";

beforeAll(async () => {
  await ensureData();
});

async function run(tool: { invoke: (args: any) => Promise<unknown> }, args: object) {
  return JSON.parse((await tool.invoke(args)) as string) as ToolResult;
}

describe("tournament tools", () => {
  it("lists all tournaments including women's", async () => {
    const res = await run(listTournaments, {});
    const years = (res.data as { year: number; name: string }[]);
    expect(years.length).toBeGreaterThanOrEqual(29);
    expect(years.some((t) => t.name.includes("Women's"))).toBe(true);
  });

  it("2022 men's champion is Argentina", async () => {
    const res = await run(getTournamentStandings, { year: 2022 });
    const standings = res.data as { position: number; team: string }[];
    expect(standings[0]).toMatchObject({ position: 1, team: "Argentina" });
    expect(standings[1].team).toBe("France");
  });

  it("2018 Golden Boot went to Harry Kane", async () => {
    const res = await run(listAwardWinners, { award: "Golden Boot", year: 2018 });
    const winners = res.data as { player: string }[];
    expect(winners.map((w) => w.player)).toContain("Harry Kane");
  });
});

describe("player tools", () => {
  it("Miroslav Klose has 16 World Cup goals", async () => {
    const res = await run(getPlayerStats, { name: "Klose" });
    expect((res.data as { total_goals: number }).total_goals).toBe(16);
  });

  it("Klose tops the all-time men's scorer list", async () => {
    const res = await run(topGoalScorers, { gender: "men", limit: 5 });
    const ranked = res.data as { rank: number; name: string; goals: number }[];
    expect(ranked[0].name).toContain("Klose");
    expect(ranked[0].goals).toBe(16);
  });

  it("Marta leads the women's all-time list", async () => {
    const res = await run(topGoalScorers, { gender: "women", limit: 3 });
    const ranked = res.data as { name: string }[];
    expect(ranked[0].name).toBe("Marta");
  });
});

describe("match tools", () => {
  it("finds the 2014 final (Argentina 0-1 Germany) and only the final", async () => {
    const res = await run(findMatches, { year: 2014, stage: "final" });
    const { matches } = res.data as {
      matches: { match: string; score: string; stage: string }[];
    };
    expect(matches).toHaveLength(1);
    expect(matches[0].match).toBe("Germany vs Argentina");
    expect(matches[0].score).toBe("1–0");
  });

  it("Brazil vs Argentina head-to-head returns meetings", async () => {
    const res = await run(headToHead, { team1: "Brazil", team2: "Argentina" });
    const data = res.data as { meetings: number; record: Record<string, number> };
    expect(data.meetings).toBeGreaterThanOrEqual(4);
    expect(data.record).toHaveProperty("Brazil");
  });

  it("Brazil's men's record shows 5 titles", async () => {
    const res = await run(getTeamRecord, { team: "Brazil", gender: "men" });
    const data = res.data as { titles: string[]; matches_played: number };
    expect(data.titles).toHaveLength(5);
    expect(data.matches_played).toBeGreaterThan(100);
  });
});
