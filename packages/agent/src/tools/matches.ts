import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadTable, type Row } from "../data/loader.js";
import {
  matchesGender,
  matchesTeam,
  normalize,
  toolResult,
  tournamentYear,
} from "./helpers.js";

const genderSchema = z
  .enum(["men", "women"])
  .optional()
  .describe("Filter by men's or women's World Cup. Omit for both.");

function matchSummary(m: Row) {
  return {
    tournament: m.tournament_name,
    date: m.match_date,
    stage: m.stage_name,
    match: m.match_name,
    score: m.score,
    extra_time: m.extra_time === "1",
    penalty_shootout: m.penalty_shootout === "1",
    score_penalties: m.penalty_shootout === "1" ? m.score_penalties : undefined,
    result: m.result,
    stadium: m.stadium_name,
    city: m.city_name,
  };
}

export const findMatches = tool(
  async ({ year, team, stage, gender, limit }) => {
    const max = limit ?? 25;
    const base = loadTable("matches").filter(
      (m) =>
        matchesGender(m.tournament_name, gender) &&
        (year === undefined || tournamentYear(m) === year) &&
        (team === undefined ||
          matchesTeam(m.home_team_name, m.home_team_code, team) ||
          matchesTeam(m.away_team_name, m.away_team_code, team))
    );
    // Exact stage match first so "final" doesn't also return semi-finals etc.
    let rows = base;
    if (stage !== undefined) {
      const q = normalize(stage);
      const exact = base.filter((m) => normalize(m.stage_name) === q);
      rows = exact.length > 0 ? exact : base.filter((m) => normalize(m.stage_name).includes(q));
    }
    return toolResult("match-list", "World Cup matches", {
      total_found: rows.length,
      showing: Math.min(rows.length, max),
      matches: rows.slice(0, max).map(matchSummary),
    });
  },
  {
    name: "find_matches",
    description:
      "Find World Cup matches filtered by year, team, stage (e.g. 'final', 'semi-finals', 'group stage'), or gender. Returns scores and venues.",
    schema: z.object({
      year: z.number().int().optional().describe("Tournament year, e.g. 2014"),
      team: z.string().optional().describe("Team name or 3-letter code"),
      stage: z.string().optional().describe("Stage name, e.g. 'final', 'semi-finals'"),
      gender: genderSchema,
      limit: z.number().int().optional().describe("Max matches to return (default 25)"),
    }),
  }
);

export const headToHead = tool(
  async ({ team1, team2, gender }) => {
    const rows = loadTable("matches").filter((m) => {
      if (!matchesGender(m.tournament_name, gender)) return false;
      const homeIs1 = matchesTeam(m.home_team_name, m.home_team_code, team1);
      const awayIs1 = matchesTeam(m.away_team_name, m.away_team_code, team1);
      const homeIs2 = matchesTeam(m.home_team_name, m.home_team_code, team2);
      const awayIs2 = matchesTeam(m.away_team_name, m.away_team_code, team2);
      return (homeIs1 && awayIs2) || (homeIs2 && awayIs1);
    });
    if (rows.length === 0) {
      return toolResult("error", "No meetings found", {
        message: `${team1} and ${team2} have never met at a World Cup (in this dataset).`,
      });
    }
    let wins1 = 0;
    let wins2 = 0;
    let draws = 0;
    for (const m of rows) {
      const team1IsHome = matchesTeam(m.home_team_name, m.home_team_code, team1);
      if (m.draw === "1") draws += 1;
      else if ((m.home_team_win === "1") === team1IsHome) wins1 += 1;
      else wins2 += 1;
    }
    return toolResult("head-to-head", `${team1} vs ${team2} at the World Cup`, {
      meetings: rows.length,
      record: { [team1]: wins1, [team2]: wins2, draws },
      note: "Matches decided on penalties count as draws in the win/loss record; check score_penalties for the shootout winner.",
      matches: rows.map(matchSummary),
    });
  },
  {
    name: "head_to_head",
    description:
      "Head-to-head World Cup record between two national teams: meetings, wins/draws, and every match played.",
    schema: z.object({
      team1: z.string().describe("First team name, e.g. 'Brazil'"),
      team2: z.string().describe("Second team name, e.g. 'Argentina'"),
      gender: genderSchema,
    }),
  }
);

export const getTeamRecord = tool(
  async ({ team, gender }) => {
    const matches = loadTable("matches").filter(
      (m) =>
        matchesGender(m.tournament_name, gender) &&
        (matchesTeam(m.home_team_name, m.home_team_code, team) ||
          matchesTeam(m.away_team_name, m.away_team_code, team))
    );
    if (matches.length === 0) {
      return toolResult("error", "Team not found", {
        message: `No World Cup matches found for "${team}".`,
      });
    }
    const canonical = matchesTeam(
      matches[0].home_team_name,
      matches[0].home_team_code,
      team
    )
      ? matches[0].home_team_name
      : matches[0].away_team_name;

    let wins = 0,
      draws = 0,
      losses = 0,
      goalsFor = 0,
      goalsAgainst = 0;
    const tournaments = new Set<string>();
    for (const m of matches) {
      const isHome = matchesTeam(m.home_team_name, m.home_team_code, team);
      tournaments.add(m.tournament_name);
      goalsFor += Number(isHome ? m.home_team_score : m.away_team_score);
      goalsAgainst += Number(isHome ? m.away_team_score : m.home_team_score);
      if (m.draw === "1") draws += 1;
      else if ((m.home_team_win === "1") === isHome) wins += 1;
      else losses += 1;
    }

    const standings = loadTable("tournament_standings").filter(
      (s) =>
        matchesGender(s.tournament_name, gender) &&
        matchesTeam(s.team_name, s.team_code, team)
    );
    const titles = standings.filter((s) => s.position === "1");
    const runnerUp = standings.filter((s) => s.position === "2");

    return toolResult("team-card", `${canonical} — World Cup record`, {
      team: canonical,
      tournaments_played: tournaments.size,
      matches_played: matches.length,
      wins,
      draws,
      losses,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      titles: titles.map((s) => s.tournament_name),
      runner_up: runnerUp.map((s) => s.tournament_name),
      note: "Matches decided on penalties count as draws.",
    });
  },
  {
    name: "get_team_record",
    description:
      "Get a national team's overall World Cup record: tournaments played, W/D/L, goals for/against, titles, and runner-up finishes.",
    schema: z.object({
      team: z.string().describe("Team name or 3-letter code, e.g. 'Germany' or 'GER'"),
      gender: genderSchema,
    }),
  }
);
