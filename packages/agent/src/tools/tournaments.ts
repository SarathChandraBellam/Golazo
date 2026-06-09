import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadTable } from "../data/loader.js";
import {
  matchesGender,
  normalize,
  toolResult,
  tournamentYear,
  playerName,
} from "./helpers.js";

const genderSchema = z
  .enum(["men", "women"])
  .optional()
  .describe("Filter by men's or women's World Cup. Omit for both.");

export const listTournaments = tool(
  async ({ gender }) => {
    const rows = loadTable("tournaments").filter((t) =>
      matchesGender(t.tournament_name, gender)
    );
    return toolResult(
      "tournament-list",
      "FIFA World Cup tournaments",
      rows.map((t) => ({
        year: Number(t.year),
        name: t.tournament_name,
        host: t.host_country,
        winner: t.winner,
        teams: Number(t.count_teams),
      }))
    );
  },
  {
    name: "list_tournaments",
    description:
      "List all FIFA World Cup tournaments (men's 1930-2022, women's 1991-2019) with host country and winner.",
    schema: z.object({ gender: genderSchema }),
  }
);

export const getTournamentStandings = tool(
  async ({ year, gender }) => {
    const g = gender ?? "men";
    const rows = loadTable("tournament_standings").filter(
      (s) => tournamentYear(s) === year && matchesGender(s.tournament_name, g)
    );
    if (rows.length === 0) {
      return toolResult("error", "No standings found", {
        message: `No ${g}'s World Cup standings for ${year}. Use list_tournaments to see valid years.`,
      });
    }
    return toolResult(
      "standings",
      `${rows[0].tournament_name} — final standings`,
      rows
        .map((s) => ({ position: Number(s.position), team: s.team_name, code: s.team_code }))
        .sort((a, b) => a.position - b.position)
    );
  },
  {
    name: "get_tournament_standings",
    description:
      "Get the final standings (champion, runner-up, third, fourth) of a specific World Cup tournament.",
    schema: z.object({
      year: z.number().int().describe("Tournament year, e.g. 2018"),
      gender: genderSchema,
    }),
  }
);

export const listAwardWinners = tool(
  async ({ award, year, gender }) => {
    const rows = loadTable("award_winners").filter(
      (w) =>
        matchesGender(w.tournament_name, gender) &&
        (year === undefined || tournamentYear(w) === year) &&
        (award === undefined || normalize(w.award_name).includes(normalize(award)))
    );
    return toolResult(
      "award-list",
      "World Cup award winners",
      rows.map((w) => ({
        tournament: w.tournament_name,
        award: w.award_name,
        player: playerName(w),
        team: w.team_name,
        shared: w.shared === "1",
      }))
    );
  },
  {
    name: "list_award_winners",
    description:
      "List World Cup individual award winners (Golden Ball/best player, Golden Boot/top scorer, Golden Glove/best goalkeeper, Best Young Player). Filter by award name, year, or gender.",
    schema: z.object({
      award: z.string().optional().describe("Award name filter, e.g. 'Golden Boot'"),
      year: z.number().int().optional().describe("Tournament year"),
      gender: genderSchema,
    }),
  }
);
