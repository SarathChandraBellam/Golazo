import "./env.js";
import { createInterface } from "node:readline/promises";
import {
  HumanMessage,
  isAIMessage,
  isToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { createWorldCupAgent } from "./agent.js";

async function main() {
  const agent = await createWorldCupAgent();
  const config = { configurable: { thread_id: `cli-${Date.now()}` } };

  console.log("⚽ Golazo — World Cup stats agent (Ctrl+C or 'exit' to quit)");
  console.log(`   model: ${process.env.OPENROUTER_MODEL ?? "default"}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const question = (await rl.question("you> ")).trim();
    if (!question) continue;
    if (question === "exit" || question === "quit") break;

    try {
      const stream = await agent.stream(
        { messages: [new HumanMessage(question)] },
        { ...config, streamMode: "updates" }
      );
      for await (const update of stream) {
        for (const nodeOutput of Object.values(update)) {
          for (const msg of (nodeOutput as { messages?: BaseMessage[] }).messages ?? []) {
            if (isAIMessage(msg) && msg.tool_calls?.length) {
              for (const tc of msg.tool_calls) {
                console.log(`  ↳ tool: ${tc.name}(${JSON.stringify(tc.args)})`);
              }
            } else if (isToolMessage(msg)) {
              const text = typeof msg.content === "string" ? msg.content : "";
              console.log(`  ↳ result: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`);
            } else if (isAIMessage(msg) && msg.content) {
              console.log(`\nagent> ${msg.content}\n`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : err}`);
    }
  }
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
