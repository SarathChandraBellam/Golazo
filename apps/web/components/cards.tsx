"use client";

import type { ReactNode } from "react";

/* Tool results arrive as { ui: { component, title }, data } — each component
   name maps to a card below. Unknown components fall back to a data table. */

export interface ToolUi {
  ui: { component: string; title: string };
  data: unknown;
}

export function parseToolResult(content: string): ToolUi | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "ui" in parsed && "data" in parsed) {
      return parsed as ToolUi;
    }
  } catch {
    /* not JSON — render nothing */
  }
  return null;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card max-w-2xl px-5 py-4">
      <div className="card-title mb-3 flex items-center gap-2 text-sm text-volt">
        <span aria-hidden className="inline-block h-2 w-2 bg-volt" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Pct({ value }: { value: number }) {
  return <span className="font-mono text-sm">{(value * 100).toFixed(1)}%</span>;
}

function ProbBar({
  label,
  value,
  color = "var(--volt)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <span className="text-sm text-chalk">{label}</span>
        <Pct value={value} />
      </div>
      <div className="h-2 bg-[rgba(239,243,232,0.07)]">
        <div
          className="bar h-full"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ---------- stats cards ---------- */

function Leaderboard({ data }: { data: { rank: number; name: string; team: string; goals: number }[] }) {
  const max = Math.max(...data.map((d) => d.goals), 1);
  return (
    <ol className="space-y-1.5">
      {data.map((d) => (
        <li key={d.rank} className="flex items-center gap-3">
          <span className="font-display w-7 text-right text-lg font-bold text-muted">
            {d.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-medium">{d.name}</span>
              <span className="shrink-0 text-xs text-muted">{d.team}</span>
            </div>
            <div className="mt-0.5 h-1.5 bg-[rgba(239,243,232,0.07)]">
              <div
                className="bar h-full bg-volt"
                style={{ width: `${(d.goals / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="font-mono w-8 text-right text-lg text-volt">{d.goals}</span>
        </li>
      ))}
    </ol>
  );
}

function Standings({ data }: { data: { position: number; team: string; code: string }[] }) {
  const medal = ["text-gold", "text-chalk", "text-[#cd9b6a]"];
  return (
    <ol className="space-y-1">
      {data.map((d) => (
        <li key={d.position} className="flex items-center gap-3 text-sm">
          <span
            className={`font-display w-7 text-right text-xl font-black ${medal[d.position - 1] ?? "text-muted"}`}
          >
            {d.position}
          </span>
          <span className={d.position === 1 ? "text-lg font-semibold text-gold" : ""}>
            {d.team}
          </span>
          <span className="font-mono text-xs text-muted">{d.code}</span>
          {d.position === 1 && <span aria-hidden className="text-gold">★</span>}
        </li>
      ))}
    </ol>
  );
}

function PlayerCard({ data }: { data: Record<string, unknown> }) {
  const goalsBy = (data.goals_by_tournament ?? {}) as Record<string, number>;
  const awards = (data.awards ?? []) as { award: string; tournament: string }[];
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl font-black uppercase leading-none">
            {String(data.name ?? "")}
          </div>
          <div className="mt-1 text-xs text-muted">
            {[data.birth_date, (data.positions as string[])?.join(" / "), (data.teams as string[])?.join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl font-bold leading-none text-volt">
            {Number(data.total_goals ?? 0)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted">goals</div>
        </div>
      </div>
      {Object.keys(goalsBy).length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(goalsBy).map(([t, g]) => (
              <tr key={t} className="border-t border-[var(--line)]">
                <td className="py-1 pr-2 text-muted">{t.replace(" FIFA Men's World Cup", "").replace(" FIFA Women's World Cup", " (W)")}</td>
                <td className="font-mono py-1 text-right text-volt">{g}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {awards.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {awards.map((a, i) => (
            <span
              key={i}
              className="border border-[var(--line-strong)] bg-[var(--volt-soft)] px-2 py-0.5 text-xs text-volt"
            >
              {a.award} · {parseInt(a.tournament, 10) || a.tournament}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchList({ data }: { data: { total_found: number; showing: number; matches: Record<string, string | boolean>[] } }) {
  return (
    <div>
      <ul className="space-y-1">
        {data.matches.map((m, i) => (
          <li
            key={i}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-[var(--line)] py-1.5 text-sm first:border-t-0"
          >
            <span className="font-mono text-xs text-muted">{String(m.date)}</span>
            <span className="flex-1 font-medium">{String(m.match)}</span>
            <span className="font-mono text-volt">
              {String(m.score)}
              {m.penalty_shootout ? ` (${m.score_penalties} pens)` : ""}
            </span>
            <span className="w-full text-xs text-muted sm:w-auto">
              {String(m.stage)} · {String(m.city)}
            </span>
          </li>
        ))}
      </ul>
      {data.total_found > data.showing && (
        <div className="mt-2 text-xs text-muted">
          showing {data.showing} of {data.total_found} matches
        </div>
      )}
    </div>
  );
}

function HeadToHead({ data }: { data: { meetings: number; record: Record<string, number>; matches: Record<string, string | boolean>[] } }) {
  const entries = Object.entries(data.record);
  const draws = entries.find(([k]) => k === "draws")?.[1] ?? 0;
  const teams = entries.filter(([k]) => k !== "draws");
  const total = Math.max(data.meetings, 1);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        {teams.map(([team, wins], i) => (
          <div key={team} className={`${i === 1 ? "text-right" : ""}`}>
            <div className="font-display text-2xl font-black uppercase leading-none">
              {team}
            </div>
            <div
              className={`font-mono text-3xl font-bold ${i === 0 ? "text-volt" : "text-away"}`}
            >
              {wins}
            </div>
          </div>
        ))}
      </div>
      <div className="mb-1 flex h-2.5 w-full overflow-hidden">
        <div
          className="bar bg-volt"
          style={{ width: `${((teams[0]?.[1] ?? 0) / total) * 100}%` }}
        />
        <div
          className="bar bg-[rgba(239,243,232,0.25)]"
          style={{ width: `${(draws / total) * 100}%` }}
        />
        <div
          className="bar bg-away"
          style={{ width: `${((teams[1]?.[1] ?? 0) / total) * 100}%` }}
        />
      </div>
      <div className="mb-3 text-center text-xs text-muted">
        {data.meetings} meetings · {draws} draws
      </div>
      <MatchList data={{ total_found: data.matches.length, showing: data.matches.length, matches: data.matches }} />
    </div>
  );
}

function TeamCard({ data }: { data: Record<string, unknown> }) {
  const stats: [string, unknown][] = [
    ["Tournaments", data.tournaments_played],
    ["Matches", data.matches_played],
    ["W / D / L", `${data.wins} / ${data.draws} / ${data.losses}`],
    ["Goals", `${data.goals_for} : ${data.goals_against}`],
  ];
  const titles = (data.titles ?? []) as string[];
  return (
    <div>
      <div className="font-display mb-3 text-3xl font-black uppercase leading-none">
        {String(data.team ?? "")}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="border border-[var(--line)] px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
            <div className="font-mono text-lg text-chalk">{String(value)}</div>
          </div>
        ))}
      </div>
      {titles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {titles.map((t) => (
            <span key={t} className="border border-[var(--line-strong)] bg-[rgba(242,201,76,0.12)] px-2 py-0.5 text-xs text-gold">
              ★ {parseInt(t, 10) || t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AwardList({ data }: { data: { tournament: string; award: string; player: string; team: string }[] }) {
  return (
    <ul className="space-y-1">
      {data.map((w, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 border-t border-[var(--line)] py-1.5 text-sm first:border-t-0">
          <span className="font-mono text-xs text-muted">{parseInt(w.tournament, 10) || w.tournament}</span>
          <span className="text-gold">{w.award}</span>
          <span className="flex-1 font-medium">{w.player}</span>
          <span className="text-xs text-muted">{w.team}</span>
        </li>
      ))}
    </ul>
  );
}

function TournamentList({ data }: { data: { year: number; name: string; host: string; winner: string }[] }) {
  return (
    <ul className="space-y-1">
      {data.map((t) => (
        <li key={t.name} className="flex flex-wrap items-baseline gap-x-3 border-t border-[var(--line)] py-1.5 text-sm first:border-t-0">
          <span className="font-display text-lg font-bold text-volt">{t.year}</span>
          <span className="text-xs text-muted">{t.name.includes("Women") ? "W" : "M"}</span>
          <span className="flex-1 text-muted">host: {t.host}</span>
          <span className="font-medium text-gold">★ {t.winner}</span>
        </li>
      ))}
    </ul>
  );
}

function PlayerList({ data }: { data: { name: string; birth_date: string; gender: string; positions: string[]; tournaments: string }[] }) {
  return (
    <ul className="space-y-1">
      {data.map((p, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 border-t border-[var(--line)] py-1.5 text-sm first:border-t-0">
          <span className="font-medium">{p.name}</span>
          <span className="text-xs text-muted">
            {p.positions?.join("/")} · {p.gender} · WC {p.tournaments}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- simulation cards ---------- */

function MatchSim({ data }: { data: Record<string, unknown> }) {
  const probs = data.probabilities as { team1_win: number; draw: number; team2_win: number };
  const advance = data.advance as { team1: number; team2: number } | undefined;
  const scorelines = (data.top_scorelines ?? []) as { score: string; probability: number }[];
  const xg = data.expected_goals as { team1: number; team2: number };
  return (
    <div>
      <div className="font-display mb-3 text-xl font-black uppercase">
        {String(data.team1)} <span className="text-muted">vs</span> {String(data.team2)}
      </div>
      <ProbBar label={`${data.team1} win`} value={probs.team1_win} />
      <ProbBar label="Draw" value={probs.draw} color="rgba(239,243,232,0.35)" />
      <ProbBar label={`${data.team2} win`} value={probs.team2_win} color="var(--away)" />
      {advance && (
        <div className="mt-2 border-t border-[var(--line)] pt-2 text-sm text-muted">
          Advances (incl. extra time + pens):{" "}
          <span className="text-volt">{String(data.team1)} <Pct value={advance.team1} /></span>
          {" · "}
          <span className="text-away">{String(data.team2)} <Pct value={advance.team2} /></span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {scorelines.map((s) => (
          <span key={s.score} className="border border-[var(--line-strong)] px-2 py-0.5 font-mono text-xs">
            {s.score} <span className="text-muted">{(s.probability * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
      <div className="mt-3 text-[11px] leading-snug text-muted">
        xG {xg?.team1} : {xg?.team2} · {Number(data.iterations).toLocaleString()} simulations · {String(data.basis ?? "")}
      </div>
    </div>
  );
}

function TournamentSim({ data }: { data: Record<string, unknown> }) {
  const champs = (data.champion_probabilities ?? []) as { team: string; probability: number }[];
  const sample = (data.sample_run ?? []) as { round: string; results: string[] }[];
  const final = sample.at(-1);
  return (
    <div>
      {champs.slice(0, 8).map((c, i) => (
        <ProbBar
          key={c.team}
          label={`${i + 1}. ${c.team}`}
          value={c.probability}
          color={i === 0 ? "var(--gold)" : "var(--volt)"}
        />
      ))}
      {final && (
        <div className="mt-3 border-t border-[var(--line)] pt-2 text-xs text-muted">
          sample final: {final.results[0]}
        </div>
      )}
      <div className="mt-2 text-[11px] leading-snug text-muted">
        {Number(data.iterations).toLocaleString()} simulated tournaments · {String(data.basis ?? "")}
      </div>
    </div>
  );
}

/* ---------- fallback + dispatcher ---------- */

function Fallback({ data }: { data: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto font-mono text-xs leading-relaxed text-muted">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function ToolCard({ result }: { result: ToolUi }) {
  const { component, title } = result.ui;
  const data = result.data;
  const body = (() => {
    try {
      switch (component) {
        case "leaderboard":
          return <Leaderboard data={data as never} />;
        case "standings":
          return <Standings data={data as never} />;
        case "player-card":
          return <PlayerCard data={data as never} />;
        case "player-list":
          return <PlayerList data={data as never} />;
        case "match-list":
          return <MatchList data={data as never} />;
        case "head-to-head":
          return <HeadToHead data={data as never} />;
        case "team-card":
          return <TeamCard data={data as never} />;
        case "award-list":
          return <AwardList data={data as never} />;
        case "tournament-list":
          return <TournamentList data={data as never} />;
        case "match-sim":
          return <MatchSim data={data as never} />;
        case "tournament-sim":
          return <TournamentSim data={data as never} />;
        case "error":
          return (
            <div className="text-sm text-away">
              {String((data as { message?: string }).message ?? "Something went wrong")}
            </div>
          );
        default:
          return <Fallback data={data} />;
      }
    } catch {
      return <Fallback data={data} />;
    }
  })();
  return <Card title={title}>{body}</Card>;
}
