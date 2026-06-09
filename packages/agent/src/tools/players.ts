import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadTable, type Row } from "../data/loader.js";
import {
  matchesGender,
  matchesPlayerName,
  playerName,
  toolResult,
  tournamentYear,
} from "./helpers.js";

const genderSchema = z
  .enum(["men", "women"])
  .optional()
  .describe("Filter by men's or women's World Cup. Omit for both.");

function positions(p: Row): string[] {
  const out: string[] = [];
  if (p.goal_keeper === "1") out.push("goalkeeper");
  if (p.defender === "1") out.push("defender");
  if (p.midfielder === "1") out.push("midfielder");
  if (p.forward === "1") out.push("forward");
  return out;
}

export const searchPlayers = tool(
  async ({ name }) => {
    const rows = loadTable("players")
      .filter((p) => matchesPlayerName(p, name))
      .slice(0, 25);
    return toolResult(
      "player-list",
      `Players matching "${name}"`,
      rows.map((p) => ({
        player_id: p.player_id,
        name: playerName(p),
        birth_date: p.birth_date,
        gender: p.female === "1" ? "women" : "men",
        positions: positions(p),
        tournaments: p.list_tournaments,
      }))
    );
  },
  {
    name: "search_players",
    description:
      "Search World Cup players by (partial) name. Returns basic info and which tournaments they played in.",
    schema: z.object({
      name: z.string().describe("Player name or part of it, e.g. 'Messi'"),
    }),
  }
);

export const getPlayerStats = tool(
  async ({ name }) => {
    const players = loadTable("players").filter((p) => matchesPlayerName(p, name));
    if (players.length === 0) {
      return toolResult("error", "Player not found", {
        message: `No player matching "${name}". Try search_players with a shorter query.`,
      });
    }
    // If several players match, prefer the one with most tournaments, but report alternatives
    const sorted = [...players].sort(
      (a, b) => Number(b.count_tournaments) - Number(a.count_tournaments)
    );
    const player = sorted[0];
    const id = player.player_id;

    const goals = loadTable("goals").filter(
      (g) => g.player_id === id && g.own_goal !== "1"
    );
    const goalsByTournament: Record<string, number> = {};
    for (const g of goals) {
      goalsByTournament[g.tournament_name] =
        (goalsByTournament[g.tournament_name] ?? 0) + 1;
    }
    const squads = loadTable("squads").filter((s) => s.player_id === id);
    const awards = loadTable("award_winners")
      .filter((w) => w.player_id === id)
      .map((w) => ({ award: w.award_name, tournament: w.tournament_name }));

    return toolResult("player-card", `World Cup stats — ${playerName(player)}`, {
      player_id: id,
      name: playerName(player),
      birth_date: player.birth_date,
      gender: player.female === "1" ? "women" : "men",
      positions: positions(player),
      teams: [...new Set(squads.map((s) => s.team_name))],
      tournaments: player.list_tournaments,
      total_goals: goals.length,
      goals_by_tournament: goalsByTournament,
      awards,
      other_matches:
        sorted.length > 1 ? sorted.slice(1, 5).map((p) => playerName(p)) : undefined,
    });
  },
  {
    name: "get_player_stats",
    description:
      "Get a player's full World Cup record: teams, tournaments, total goals, goals per tournament, and individual awards.",
    schema: z.object({
      name: z.string().describe("Player name, e.g. 'Miroslav Klose'"),
    }),
  }
);

export const topGoalScorers = tool(
  async ({ year, team, gender, limit }) => {
    const max = limit ?? 10;
    const goals = loadTable("goals").filter(
      (g) =>
        g.own_goal !== "1" &&
        matchesGender(g.tournament_name, gender) &&
        (year === undefined || tournamentYear(g) === year) &&
        (team === undefined ||
          g.player_team_name.toLowerCase().includes(team.toLowerCase()))
    );
    const byPlayer = new Map<string, { name: string; team: string; goals: number }>();
    for (const g of goals) {
      const entry = byPlayer.get(g.player_id) ?? {
        name: playerName(g),
        team: g.player_team_name,
        goals: 0,
      };
      entry.goals += 1;
      entry.team = g.player_team_name;
      byPlayer.set(g.player_id, entry);
    }
    const ranked = [...byPlayer.values()]
      .sort((a, b) => b.goals - a.goals)
      .slice(0, max)
      .map((e, i) => ({ rank: i + 1, ...e }));

    const scope = [
      year ? `${year}` : "all-time",
      gender ? `${gender}'s` : "",
      team ? `(${team})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return toolResult("leaderboard", `Top World Cup goal scorers — ${scope}`, ranked);
  },
  {
    name: "top_goal_scorers",
    description:
      "Rank top goal scorers (own goals excluded). Filter by tournament year, team, or gender; defaults to all-time across all tournaments.",
    schema: z.object({
      year: z.number().int().optional().describe("Restrict to one tournament year"),
      team: z.string().optional().describe("Restrict to a national team, e.g. 'Brazil'"),
      gender: genderSchema,
      limit: z.number().int().optional().describe("How many players to return (default 10)"),
    }),
  }
);
