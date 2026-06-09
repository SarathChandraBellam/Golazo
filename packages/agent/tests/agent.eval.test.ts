import "../src/env.js";
import { describe, expect, it } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { createWorldCupAgent } from "../src/agent.js";
import { testModelName } from "../src/llm.js";

/**
 * End-to-end evals delegated to a smaller free model (OPENROUTER_TEST_MODEL)
 * to save quota on the main model. Skipped unless RUN_EVALS=1 and an API key
 * is present:  pnpm test:eval
 */
const enabled = process.env.RUN_EVALS === "1" && !!process.env.OPENROUTER_API_KEY;

describe.skipIf(!enabled)(`agent evals (model: ${testModelName()})`, () => {
  async function ask(question: string): Promise<string> {
    const agent = await createWorldCupAgent({ model: testModelName() });
    const result = await agent.invoke(
      { messages: [new HumanMessage(question)] },
      { configurable: { thread_id: `eval-${Math.random()}` } }
    );
    const last = result.messages.at(-1);
    return typeof last?.content === "string"
      ? last.content
      : JSON.stringify(last?.content);
  }

  it("answers who won the 2018 World Cup", async () => {
    expect(await ask("Who won the 2018 World Cup?")).toMatch(/France/i);
  });

  it("answers all-time top scorer with tools", async () => {
    expect(await ask("Who is the all-time top scorer in men's World Cup history?")).toMatch(
      /Klose/i
    );
  });

  it("answers head-to-head questions", async () => {
    const answer = await ask("How many times have Brazil and Argentina met at the World Cup?");
    expect(answer).toMatch(/\d/);
  });
});
