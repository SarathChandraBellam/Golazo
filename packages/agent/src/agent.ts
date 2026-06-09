import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ensureData } from "./data/loader.js";
import { createLLM, pickAvailableModel } from "./llm.js";
import { allSkills, buildSystemPrompt, type AgentSkill } from "./skills/index.js";

export interface AgentOptions {
  /** OpenRouter model id; defaults to OPENROUTER_MODEL env or the built-in default */
  model?: string;
  /** Subset of skills to enable; defaults to all */
  skills?: AgentSkill[];
}

/** Create the World Cup stats agent (downloads dataset CSVs on first run). */
export async function createWorldCupAgent(options: AgentOptions = {}) {
  await ensureData();
  const model = await pickAvailableModel(options.model);
  console.error(`using model: ${model}`);
  const skills = options.skills ?? allSkills;
  return createReactAgent({
    llm: createLLM({ model }),
    tools: skills.flatMap((s) => s.tools),
    prompt: buildSystemPrompt(skills),
    checkpointSaver: new MemorySaver(),
  });
}

export type WorldCupAgent = Awaited<ReturnType<typeof createWorldCupAgent>>;
