import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { simulateMatch, simulateTournament } from "../sim/simulate.js";
import { toolResult } from "./helpers.js";

const genderSchema = z
  .enum(["men", "women"])
  .optional()
  .describe("Simulate using men's or women's World Cup history (default men).");

export const simulateMatchTool = tool(
  async ({ team1, team2, gender, knockout }) => {
    const res = simulateMatch({ team1, team2, gender, knockout });
    if ("error" in res) {
      return toolResult("error", "Simulation failed", { message: res.error });
    }
    return toolResult("match-sim", `Simulation: ${res.team1} vs ${res.team2}`, res);
  },
  {
    name: "simulate_match",
    description:
      "Monte Carlo simulation (10,000 runs) of a hypothetical World Cup match between two teams, using a Poisson model fit on recency-weighted historical results. Returns win/draw probabilities, expected goals, and most likely scorelines. Set knockout=true for elimination games (adds extra time + penalty shootouts).",
    schema: z.object({
      team1: z.string().describe("First team, e.g. 'Brazil'"),
      team2: z.string().describe("Second team, e.g. 'Germany'"),
      gender: genderSchema,
      knockout: z
        .boolean()
        .optional()
        .describe("If true, ties are resolved by extra time and penalties"),
    }),
  }
);

export const simulateTournamentTool = tool(
  async ({ teams, gender }) => {
    const res = simulateTournament({ teams, gender });
    if ("error" in res) {
      return toolResult("error", "Simulation failed", { message: res.error });
    }
    return toolResult(
      "tournament-sim",
      `Simulated knockout bracket (${teams.length} teams)`,
      res
    );
  },
  {
    name: "simulate_tournament",
    description:
      "Monte Carlo simulation of a single-elimination knockout tournament between 4, 8, 16, or 32 teams (paired in the order given). Returns each team's probability of winning the title and reaching the final, plus one sample bracket run.",
    schema: z.object({
      teams: z
        .array(z.string())
        .describe("Team names in bracket order; length must be 4, 8, 16, or 32"),
      gender: genderSchema,
    }),
  }
);
