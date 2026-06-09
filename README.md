# ⚽ Golazo

World Cup stats agent monorepo. Ask any question about FIFA World Cup history
(men's 1930–2022, women's 1991–2019) and the agent answers from the
[jfjelstul/worldcup](https://github.com/jfjelstul/worldcup) dataset.

## Structure

```
packages/
  agent/        LangGraph.js agent + skills + dataset tools + simulator
apps/
  web/          Next.js chat UI — AG-UI protocol endpoint + generative UI cards, no login
```

## Stack

- **LangGraph.js** (`createReactAgent`) — chosen over CrewAI because CrewAI is
  Python-only and this is a TypeScript monorepo.
- **OpenRouter free models** — main model and a smaller model for tests/evals,
  both configurable via env.
- **Skills** — tools are grouped into skills (`tournament-stats`,
  `player-stats`, `match-analysis`, `simulation`), each with its own
  instructions; the system prompt is composed from them.
- **Simulator** — Monte Carlo match and knockout-bracket simulations from a
  Poisson model fit on recency-weighted historical results (incl. penalty
  shootouts at the real historical conversion rate).
- **AG-UI protocol** — `apps/web/app/api/agent/route.ts` streams the run as
  AG-UI SSE events (`RUN_STARTED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`,
  `TOOL_CALL_RESULT`, `RUN_FINISHED`); the browser consumes it with
  `@ag-ui/client`.
- **Generative UI cards** — every tool returns `{ ui: { component, title }, data }`
  and the front end renders a matching card (leaderboard, player-card,
  head-to-head, standings, match-sim probability bars, …) straight from tool
  results.

## Setup

```sh
pnpm install
cp .env.example .env   # add your OPENROUTER_API_KEY
pnpm download-data     # fetch dataset CSVs (also happens automatically on first run)
```

## Use

```sh
pnpm --filter web dev  # chat UI at http://localhost:3000
pnpm agent             # interactive CLI chat
pnpm test              # deterministic tool + simulator tests (no LLM)
pnpm --filter @golazo/agent test:eval   # end-to-end evals on the smaller test model
```

## Models

| Purpose | Env var | Default |
| --- | --- | --- |
| Agent | `OPENROUTER_MODEL` | `anthropic/claude-haiku-4.5` |
| Tests/evals | `OPENROUTER_TEST_MODEL` | `google/gemini-2.5-flash-lite` |

Any tool-calling model on [openrouter.ai/models](https://openrouter.ai/models)
works. On startup the agent probes the preferred model and, if it's
unavailable, falls back through `FREE_MODEL_FALLBACKS` (`src/llm.ts`) to the
first free model that responds.
