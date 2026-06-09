"use client";

import type { Message } from "@ag-ui/core";
import { useEffect, useRef, useState } from "react";
import { useGolazo } from "@/lib/useGolazo";
import { parseToolResult, ToolCard } from "@/components/cards";

const SUGGESTIONS = [
  "Who won the 2022 World Cup?",
  "Top 10 World Cup goal scorers of all time",
  "Brazil vs Germany — who has the edge?",
  "Simulate Argentina vs France in a knockout game",
  "Who won the Golden Boot in 2018?",
  "Messi's World Cup record",
];

/** Minimal markdown: **bold**, ## headings, - bullets. */
function renderText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={j} className="font-semibold text-volt">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      )
    );
    if (/^#{1,3} /.test(line)) {
      return (
        <div key={i} className="card-title mt-3 mb-1 text-sm text-chalk">
          {line.replace(/^#{1,3} /, "")}
        </div>
      );
    }
    if (/^[-*] /.test(line)) {
      return (
        <div key={i} className="flex gap-2 pl-1">
          <span aria-hidden className="text-volt">▸</span>
          <span>{parts.map((p, j) => (typeof p === "string" ? p.replace(/^[-*] /, "") : p))}</span>
        </div>
      );
    }
    return <div key={i}>{line === "" ? " " : parts}</div>;
  });
}

const TOOL_LABELS: Record<string, string> = {
  list_tournaments: "checking the tournament archive",
  get_tournament_standings: "pulling final standings",
  list_award_winners: "checking the trophy cabinet",
  search_players: "scanning the player register",
  get_player_stats: "pulling the player file",
  top_goal_scorers: "counting goals",
  find_matches: "searching match reports",
  head_to_head: "comparing the rivals",
  get_team_record: "pulling the team ledger",
  simulate_match: "running 10,000 simulations",
  simulate_tournament: "simulating the bracket",
};

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="rise flex justify-end">
        <div className="max-w-xl border border-[var(--line-strong)] bg-[var(--volt-soft)] px-4 py-2.5 text-chalk">
          {String(message.content ?? "")}
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    const result = parseToolResult(String(message.content ?? ""));
    if (!result) return null;
    return (
      <div className="flex justify-start">
        <ToolCard result={result} />
      </div>
    );
  }

  if (message.role === "assistant") {
    const text = typeof message.content === "string" ? message.content : "";
    const toolCalls = message.toolCalls ?? [];
    return (
      <div className="space-y-2">
        {toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {toolCalls.map((tc) => (
              <span
                key={tc.id}
                className="border border-[var(--line)] px-2 py-0.5 font-mono text-[11px] text-muted"
              >
                ⚙ {TOOL_LABELS[tc.function.name] ?? tc.function.name}
              </span>
            ))}
          </div>
        )}
        {text && (
          <div className="rise max-w-2xl leading-relaxed text-chalk/90">
            {renderText(text)}
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default function Chat() {
  const { messages, running, error, send } = useGolazo();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, running]);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q || running) return;
    setInput("");
    void send(q);
  };

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      <header className="flex items-center justify-between border-b border-[var(--line)] py-5">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          Gola<span className="text-volt">zo</span>
          <span aria-hidden className="ml-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-volt align-middle" />
        </h1>
        <div className="text-right font-mono text-[11px] leading-tight text-muted">
          world cup stats agent
          <br />
          1930 — 2022 · men&apos;s &amp; women&apos;s
        </div>
      </header>

      <main className="flex-1 space-y-5 py-6">
        {empty && (
          <div className="rise py-10">
            <p className="font-display mb-1 text-5xl font-black uppercase leading-none">
              Ask the<br />
              <span className="text-volt">archive.</span>
            </p>
            <p className="mb-8 mt-4 max-w-md text-muted">
              Every World Cup match, goal, and trophy since 1930 — plus Monte
              Carlo simulations of the games that never happened.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="cursor-pointer border border-[var(--line-strong)] px-3 py-1.5 text-sm text-chalk/80 transition-colors hover:border-volt hover:text-volt"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageRow key={m.id} message={m} />
        ))}

        {running && (
          <div className="ticker w-fit border border-[var(--line)] px-3 py-1.5 font-mono text-xs text-muted">
            <span className="caret">match engine running</span>
          </div>
        )}
        {error && (
          <div className="border border-away/40 bg-[var(--away-soft)] px-4 py-2.5 text-sm text-away">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="sticky bottom-0 border-t border-[var(--line)] bg-pitch/90 py-4 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="who scores, who wins, who lifts it…"
            aria-label="Ask a World Cup question"
            className="flex-1 border border-[var(--line-strong)] bg-turf px-4 py-3 text-chalk placeholder:text-muted/60 focus:border-volt focus:outline-none"
          />
          <button
            type="submit"
            disabled={running || !input.trim()}
            className="font-display cursor-pointer border border-volt bg-volt px-6 text-lg font-bold uppercase tracking-wide text-pitch transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-30"
          >
            Ask
          </button>
        </form>
      </footer>
    </div>
  );
}
