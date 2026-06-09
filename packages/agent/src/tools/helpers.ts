import type { Row } from "../data/loader.js";

/**
 * Every tool returns this shape (JSON-stringified). The `ui` block is a hint
 * for the future AG-UI front end to render a generative UI card; the model
 * reads `data` to answer the question.
 */
export interface ToolResult {
  ui: {
    /** Card component the front end should render, e.g. "player-card" */
    component: string;
    title: string;
  };
  data: unknown;
}

export function toolResult(component: string, title: string, data: unknown): string {
  return JSON.stringify({ ui: { component, title }, data } satisfies ToolResult);
}

/** Lowercase + strip diacritics so "Stábile" matches "stabile". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export type Gender = "men" | "women";

/** The dataset names tournaments "<year> FIFA Men's/Women's World Cup". */
export function matchesGender(tournamentName: string, gender?: Gender): boolean {
  if (!gender) return true;
  return gender === "men"
    ? tournamentName.includes("Men's")
    : tournamentName.includes("Women's");
}

export function tournamentYear(row: Row): number {
  return parseInt(row.tournament_name, 10);
}

export function playerName(row: Row): string {
  const given = row.given_name === "not applicable" ? "" : row.given_name;
  const family = row.family_name === "not applicable" ? "" : row.family_name;
  return `${given} ${family}`.trim();
}

export function matchesPlayerName(row: Row, query: string): boolean {
  return normalize(playerName(row)).includes(normalize(query));
}

export function matchesTeam(name: string, code: string, query: string): boolean {
  const q = normalize(query);
  return normalize(name).includes(q) || normalize(code) === q;
}
