import { mulberry32, samplePoisson, type Rng } from "./random.js";
import {
  computeStrengths,
  expectedGoals,
  findStrength,
  shootoutConversionRate,
  type StrengthModel,
  type TeamStrength,
} from "./strengths.js";
import type { Gender } from "../tools/helpers.js";

export interface MatchSimResult {
  team1: string;
  team2: string;
  iterations: number;
  expected_goals: { team1: number; team2: number };
  probabilities: { team1_win: number; draw: number; team2_win: number };
  /** Only for knockout sims: chance of advancing including extra time + shootouts */
  advance?: { team1: number; team2: number };
  top_scorelines: { score: string; probability: number }[];
  basis: string;
}

function simulateShootout(rng: Rng, conversion: number): 0 | 1 {
  let a = 0;
  let b = 0;
  for (let round = 0; round < 5; round++) {
    if (rng() < conversion) a += 1;
    if (rng() < conversion) b += 1;
    const remaining = 4 - round;
    if (a > b + remaining || b > a + remaining) break;
  }
  while (a === b) {
    const ka = rng() < conversion;
    const kb = rng() < conversion;
    if (ka !== kb) return ka ? 0 : 1;
  }
  return a > b ? 0 : 1;
}

/** Simulate one 90-minute result. Returns goals for each side. */
function play(model: StrengthModel, a: TeamStrength, b: TeamStrength, rng: Rng): [number, number] {
  const { lambdaA, lambdaB } = expectedGoals(model, a, b);
  return [samplePoisson(lambdaA, rng), samplePoisson(lambdaB, rng)];
}

/** Resolve a knockout tie: 90 min, then a shortened extra-time, then shootout. */
function playKnockout(
  model: StrengthModel,
  a: TeamStrength,
  b: TeamStrength,
  rng: Rng,
  conversion: number
): 0 | 1 {
  const [ga, gb] = play(model, a, b, rng);
  if (ga !== gb) return ga > gb ? 0 : 1;
  // Extra time = 1/3 of a match's expected goals
  const { lambdaA, lambdaB } = expectedGoals(model, a, b);
  const ea = samplePoisson(lambdaA / 3, rng);
  const eb = samplePoisson(lambdaB / 3, rng);
  if (ea !== eb) return ea > eb ? 0 : 1;
  return simulateShootout(rng, conversion);
}

export function simulateMatch(options: {
  team1: string;
  team2: string;
  gender?: Gender;
  knockout?: boolean;
  iterations?: number;
  seed?: number;
}): MatchSimResult | { error: string } {
  const gender = options.gender ?? "men";
  const model = computeStrengths(gender);
  const a = findStrength(model, options.team1);
  const b = findStrength(model, options.team2);
  if (!a || !b) {
    const missing = [!a && options.team1, !b && options.team2].filter(Boolean);
    return { error: `No ${gender}'s World Cup history for: ${missing.join(", ")}` };
  }
  const iterations = Math.min(options.iterations ?? 10_000, 50_000);
  const rng = mulberry32(options.seed ?? 42);
  const conversion = shootoutConversionRate();

  let w1 = 0;
  let w2 = 0;
  let draws = 0;
  let adv1 = 0;
  const scorelines = new Map<string, number>();

  for (let i = 0; i < iterations; i++) {
    const [ga, gb] = play(model, a, b, rng);
    const key = `${ga}-${gb}`;
    scorelines.set(key, (scorelines.get(key) ?? 0) + 1);
    if (ga > gb) w1 += 1;
    else if (gb > ga) w2 += 1;
    else {
      draws += 1;
      if (options.knockout) {
        // replay decisive phase: extra time + shootout
        const { lambdaA, lambdaB } = expectedGoals(model, a, b);
        const ea = samplePoisson(lambdaA / 3, rng);
        const eb = samplePoisson(lambdaB / 3, rng);
        const winner =
          ea !== eb ? (ea > eb ? 0 : 1) : simulateShootout(rng, conversion);
        if (winner === 0) adv1 += 1;
      }
    }
  }

  const { lambdaA, lambdaB } = expectedGoals(model, a, b);
  const round3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    team1: a.team,
    team2: b.team,
    iterations,
    expected_goals: { team1: round3(lambdaA), team2: round3(lambdaB) },
    probabilities: {
      team1_win: round3(w1 / iterations),
      draw: round3(draws / iterations),
      team2_win: round3(w2 / iterations),
    },
    advance: options.knockout
      ? {
          team1: round3((w1 + adv1) / iterations),
          team2: round3((w2 + (draws - adv1)) / iterations),
        }
      : undefined,
    top_scorelines: [...scorelines.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([score, n]) => ({ score, probability: round3(n / iterations) })),
    basis: `Poisson model fit on ${gender}'s World Cup history (recency-weighted, half-life 20y). Not a prediction of current form.`,
  };
}

export interface TournamentSimResult {
  iterations: number;
  teams: string[];
  champion_probabilities: { team: string; probability: number }[];
  final_appearance_probabilities: { team: string; probability: number }[];
  sample_run: { round: string; results: string[] }[];
  basis: string;
}

const ROUND_NAMES: Record<number, string> = {
  32: "round of 32",
  16: "round of 16",
  8: "quarter-finals",
  4: "semi-finals",
  2: "final",
};

export function simulateTournament(options: {
  teams: string[];
  gender?: Gender;
  iterations?: number;
  seed?: number;
}): TournamentSimResult | { error: string } {
  const gender = options.gender ?? "men";
  const n = options.teams.length;
  if (![4, 8, 16, 32].includes(n)) {
    return { error: `Need 4, 8, 16, or 32 teams for a knockout bracket (got ${n}).` };
  }
  const model = computeStrengths(gender);
  const entrants: TeamStrength[] = [];
  for (const t of options.teams) {
    const s = findStrength(model, t);
    if (!s) return { error: `No ${gender}'s World Cup history for: ${t}` };
    entrants.push(s);
  }
  const iterations = Math.min(options.iterations ?? 2_000, 10_000);
  const rng = mulberry32(options.seed ?? 42);
  const conversion = shootoutConversionRate();

  const titles = new Map<string, number>();
  const finals = new Map<string, number>();
  let sampleRun: { round: string; results: string[] }[] = [];

  for (let i = 0; i < iterations; i++) {
    let field = entrants;
    const thisRun: { round: string; results: string[] }[] = [];
    while (field.length > 1) {
      const next: TeamStrength[] = [];
      const results: string[] = [];
      if (field.length === 2) {
        for (const t of field) finals.set(t.team, (finals.get(t.team) ?? 0) + 1);
      }
      for (let j = 0; j < field.length; j += 2) {
        const winner =
          playKnockout(model, field[j], field[j + 1], rng, conversion) === 0
            ? field[j]
            : field[j + 1];
        next.push(winner);
        results.push(`${field[j].team} vs ${field[j + 1].team} → ${winner.team}`);
      }
      thisRun.push({ round: ROUND_NAMES[field.length] ?? `round of ${field.length}`, results });
      field = next;
    }
    titles.set(field[0].team, (titles.get(field[0].team) ?? 0) + 1);
    if (i === 0) sampleRun = thisRun;
  }

  const round3 = (x: number) => Math.round(x * 1000) / 1000;
  const toRanked = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([team, c]) => ({ team, probability: round3(c / iterations) }));

  return {
    iterations,
    teams: entrants.map((e) => e.team),
    champion_probabilities: toRanked(titles).slice(0, 10),
    final_appearance_probabilities: toRanked(finals).slice(0, 10),
    sample_run: sampleRun,
    basis: `Single-elimination bracket in listed order, Poisson model on ${gender}'s World Cup history (recency-weighted). Not a prediction of current form.`,
  };
}
