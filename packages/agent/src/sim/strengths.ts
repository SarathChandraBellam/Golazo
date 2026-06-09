import { loadTable } from "../data/loader.js";
import { matchesGender, matchesTeam, tournamentYear, type Gender } from "../tools/helpers.js";

export interface TeamStrength {
  team: string;
  code: string;
  /** Goals scored per match relative to tournament average (1 = average) */
  attack: number;
  /** Goals conceded per match relative to tournament average (lower is better) */
  defence: number;
  matches: number;
  effectiveMatches: number;
}

export interface StrengthModel {
  teams: Map<string, TeamStrength>;
  /** Average goals per team per match across the dataset */
  leagueAvgGoals: number;
  gender: Gender;
}

// Recent World Cups say more about a team than 1950s ones.
const HALF_LIFE_YEARS = 20;
// Shrink small samples toward average so 2-match teams aren't rated on noise.
const SHRINKAGE_MATCHES = 10;

const modelCache = new Map<Gender, StrengthModel>();

/** Fit attack/defence strengths for every team from historical World Cup matches. */
export function computeStrengths(gender: Gender = "men"): StrengthModel {
  const cached = modelCache.get(gender);
  if (cached) return cached;

  const matches = loadTable("matches").filter((m) =>
    matchesGender(m.tournament_name, gender)
  );
  const latestYear = Math.max(...matches.map(tournamentYear));

  interface Acc {
    team: string;
    code: string;
    wSum: number;
    wGoalsFor: number;
    wGoalsAgainst: number;
    matches: number;
  }
  const acc = new Map<string, Acc>();
  let totalWeightedGoals = 0;
  let totalWeight = 0;

  for (const m of matches) {
    const weight = 0.5 ** ((latestYear - tournamentYear(m)) / HALF_LIFE_YEARS);
    const sides = [
      { id: m.home_team_id, team: m.home_team_name, code: m.home_team_code, gf: Number(m.home_team_score), ga: Number(m.away_team_score) },
      { id: m.away_team_id, team: m.away_team_name, code: m.away_team_code, gf: Number(m.away_team_score), ga: Number(m.home_team_score) },
    ];
    for (const s of sides) {
      const a = acc.get(s.id) ?? {
        team: s.team,
        code: s.code,
        wSum: 0,
        wGoalsFor: 0,
        wGoalsAgainst: 0,
        matches: 0,
      };
      a.wSum += weight;
      a.wGoalsFor += weight * s.gf;
      a.wGoalsAgainst += weight * s.ga;
      a.matches += 1;
      acc.set(s.id, a);
      totalWeightedGoals += weight * s.gf;
      totalWeight += weight;
    }
  }

  const leagueAvgGoals = totalWeightedGoals / totalWeight;
  const teams = new Map<string, TeamStrength>();
  for (const [id, a] of acc) {
    const rawAttack = a.wGoalsFor / a.wSum / leagueAvgGoals;
    const rawDefence = a.wGoalsAgainst / a.wSum / leagueAvgGoals;
    // Shrink toward 1.0 (league average) based on effective sample size
    const n = a.wSum;
    const k = SHRINKAGE_MATCHES;
    teams.set(id, {
      team: a.team,
      code: a.code,
      attack: (n * rawAttack + k) / (n + k),
      defence: (n * rawDefence + k) / (n + k),
      matches: a.matches,
      effectiveMatches: Math.round(n * 10) / 10,
    });
  }

  const model = { teams, leagueAvgGoals, gender };
  modelCache.set(gender, model);
  return model;
}

/** Find a team's strength entry by (partial) name or code. */
export function findStrength(model: StrengthModel, query: string): TeamStrength | undefined {
  for (const s of model.teams.values()) {
    if (matchesTeam(s.team, s.code, query)) return s;
  }
  return undefined;
}

/** Expected goals for each side when a faces b. */
export function expectedGoals(
  model: StrengthModel,
  a: TeamStrength,
  b: TeamStrength
): { lambdaA: number; lambdaB: number } {
  return {
    lambdaA: model.leagueAvgGoals * a.attack * b.defence,
    lambdaB: model.leagueAvgGoals * b.attack * a.defence,
  };
}

/** Historical penalty-kick conversion rate (shootouts only). */
export function shootoutConversionRate(): number {
  const kicks = loadTable("penalty_kicks");
  if (kicks.length === 0) return 0.7;
  const converted = kicks.filter((k) => k.converted === "1").length;
  return converted / kicks.length;
}
