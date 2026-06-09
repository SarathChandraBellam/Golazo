import { ChatOpenAI } from "@langchain/openai";

// Defaults are paid models (cheap, reliable tool calling); override via
// OPENROUTER_MODEL / OPENROUTER_TEST_MODEL.
export const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
export const DEFAULT_TEST_MODEL = "google/gemini-2.5-flash-lite";

// If the preferred model is unavailable the agent probes this list and uses
// the first one that responds (free models are often rate-limited upstream).
export const FREE_MODEL_FALLBACKS = [
  "moonshotai/kimi-k2.6:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
];

async function probeModel(model: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { error?: unknown };
    return body.error === undefined;
  } catch {
    return false;
  }
}

/** Return the first available model: preferred (arg or env) first, then fallbacks. */
export async function pickAvailableModel(preferred?: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  const candidates = [
    ...new Set(
      [preferred ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL, ...FREE_MODEL_FALLBACKS]
    ),
  ];
  for (const model of candidates) {
    if (await probeModel(model, apiKey)) return model;
    console.error(`model ${model} unavailable (rate-limited?), trying next...`);
  }
  throw new Error(
    `None of the candidate models responded: ${candidates.join(", ")}. ` +
      "Free models may all be rate-limited right now — try again shortly or set OPENROUTER_MODEL."
  );
}

export function createLLM(options?: { model?: string; temperature?: number }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  return new ChatOpenAI({
    model: options?.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    temperature: options?.temperature ?? 0,
    maxRetries: 2,
    apiKey,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/golazo",
        "X-Title": "golazo",
      },
    },
  });
}

export function testModelName(): string {
  return process.env.OPENROUTER_TEST_MODEL ?? DEFAULT_TEST_MODEL;
}
