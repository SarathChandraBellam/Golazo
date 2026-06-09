import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  listTournaments,
  getTournamentStandings,
  listAwardWinners,
} from "../tools/tournaments.js";
import { searchPlayers, getPlayerStats, topGoalScorers } from "../tools/players.js";
import { findMatches, headToHead, getTeamRecord } from "../tools/matches.js";

/**
 * A skill bundles related tools with instructions on when/how to use them.
 * The agent's system prompt is composed from all registered skills, and the
 * future AG-UI layer can use skill metadata to group generative UI cards.
 */
export interface AgentSkill {
  name: string;
  description: string;
  instructions: string;
  tools: StructuredToolInterface[];
}

export const tournamentStatsSkill: AgentSkill = {
  name: "tournament-stats",
  description: "Tournament results, final standings, and individual awards",
  instructions: [
    "For 'who won the World Cup in <year>' use get_tournament_standings.",
    "For award questions (Golden Boot, Golden Ball, Golden Glove, Best Young Player) use list_award_winners.",
    "Use list_tournaments to discover valid years and hosts before guessing.",
  ].join("\n"),
  tools: [listTournaments, getTournamentStandings, listAwardWinners],
};

export const playerStatsSkill: AgentSkill = {
  name: "player-stats",
  description: "Player careers, goal tallies, and scoring leaderboards",
  instructions: [
    "For a specific player's record use get_player_stats; if unsure of the exact name, use search_players first.",
    "For 'top scorer' questions use top_goal_scorers (filter by year/team/gender as needed).",
  ].join("\n"),
  tools: [searchPlayers, getPlayerStats, topGoalScorers],
};

export const matchAnalysisSkill: AgentSkill = {
  name: "match-analysis",
  description: "Match results, head-to-head records, and team histories",
  instructions: [
    "For specific games or finals use find_matches with year/stage/team filters.",
    "For rivalry questions use head_to_head.",
    "For a country's overall World Cup history use get_team_record.",
  ].join("\n"),
  tools: [findMatches, headToHead, getTeamRecord],
};

export const allSkills: AgentSkill[] = [
  tournamentStatsSkill,
  playerStatsSkill,
  matchAnalysisSkill,
];

export function buildSystemPrompt(skills: AgentSkill[] = allSkills): string {
  const skillSections = skills
    .map((s) => `### Skill: ${s.name}\n${s.description}\n${s.instructions}`)
    .join("\n\n");

  return [
    "You are Golazo, a FIFA World Cup statistics expert.",
    "You answer questions using ONLY the jfjelstul/worldcup dataset, which covers",
    "men's World Cups 1930-2022 and women's World Cups 1991-2019.",
    "",
    "Rules:",
    "- Always answer from tool results, never from memory. If tools return nothing, say the data isn't available.",
    "- Questions default to the men's World Cup unless the user mentions women's.",
    "- Tool results are JSON with a `ui` hint and a `data` payload — base your answer on `data`.",
    "- Be concise and concrete: give numbers, years, and scores.",
    "- If a question is unrelated to the World Cup, say you only handle World Cup stats.",
    "",
    "## Your skills",
    skillSections,
  ].join("\n");
}
