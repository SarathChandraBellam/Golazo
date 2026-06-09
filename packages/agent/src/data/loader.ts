import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

// Resolves to packages/agent/data whether running from src/ (tsx) or dist/ (tsc)
const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data"
);

const BASE_URL =
  "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv";

export const DATASET_FILES = [
  "tournaments",
  "tournament_standings",
  "matches",
  "players",
  "goals",
  "awards",
  "award_winners",
  "teams",
  "squads",
  "penalty_kicks",
] as const;

export type TableName = (typeof DATASET_FILES)[number];
export type Row = Record<string, string>;

const cache = new Map<TableName, Row[]>();

/** Download any missing dataset CSVs into packages/agent/data. */
export async function ensureData(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const missing = DATASET_FILES.filter(
    (name) => !existsSync(path.join(DATA_DIR, `${name}.csv`))
  );
  if (missing.length === 0) return;

  console.error(`Downloading ${missing.length} dataset file(s) from jfjelstul/worldcup...`);
  await Promise.all(
    missing.map(async (name) => {
      const res = await fetch(`${BASE_URL}/${name}.csv`);
      if (!res.ok) {
        throw new Error(`Failed to download ${name}.csv: HTTP ${res.status}`);
      }
      await writeFile(path.join(DATA_DIR, `${name}.csv`), await res.text());
    })
  );
}

/** Load a dataset table as an array of string records (cached in memory). */
export function loadTable(name: TableName): Row[] {
  const cached = cache.get(name);
  if (cached) return cached;

  const file = path.join(DATA_DIR, `${name}.csv`);
  if (!existsSync(file)) {
    throw new Error(
      `Dataset file ${name}.csv not found. Run \`pnpm download-data\` or call ensureData() first.`
    );
  }
  const rows: Row[] = parse(readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
  });
  cache.set(name, rows);
  return rows;
}
