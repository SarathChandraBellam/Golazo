import "../src/env.js";
import { HumanMessage, isAIMessage } from "@langchain/core/messages";
import { createWorldCupAgent } from "../src/agent.js";

const question =
  process.argv[2] ??
  "Who won the Golden Boot in 2014 and how many goals did he score in that tournament?";

const agent = await createWorldCupAgent();
const res = await agent.invoke(
  { messages: [new HumanMessage(question)] },
  { configurable: { thread_id: "smoke" } }
);
for (const m of res.messages) {
  if (isAIMessage(m) && m.tool_calls?.length) {
    console.log("TOOL CALLS:", m.tool_calls.map((c) => c.name).join(", "));
  }
}
console.log("ANSWER:", res.messages.at(-1)?.content);
