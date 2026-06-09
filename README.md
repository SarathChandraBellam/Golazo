# ⚽ Golazo

World Cup stats agent monorepo. Ask any question about FIFA World Cup history
(men's 1930–2022, women's 1991–2019) and the agent answers from the
[jfjelstul/worldcup](https://github.com/jfjelstul/worldcup) dataset.

## Structure

```
packages/
  agent/        LangGraph.js agent + skills + dataset tools
apps/           (planned) AG-UI web app with generative UI cards, no login
```

## Stack

- **LangGraph.js** (`createReactAgent`) — chosen over CrewAI because CrewAI is
  Python-only and this is a TypeScript monorepo.
- **OpenRouter free models** — main model and a smaller model for tests/evals,
  both configurable via env.
- **Skills** — tools are grouped into skills (`tournament-stats`,
  `player-stats`, `match-analysis`), each with its own instructions; the system
  prompt is composed from them.
- **Generative-UI ready** — every tool returns `{ ui: { component, title }, data }`
  so the future AG-UI front end can render cards (leaderboard, player-card,
  head-to-head, standings, …) straight from tool results.

## Setup

```sh
pnpm install
cp .env.example .env   # add your OPENROUTER_API_KEY
pnpm download-data     # fetch dataset CSVs (also happens automatically on first run)
```

## Use

```sh
pnpm agent             # interactive CLI chat
pnpm test              # deterministic tool tests (no LLM)
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
