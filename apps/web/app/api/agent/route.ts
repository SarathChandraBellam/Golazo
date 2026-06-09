import "@golazo/agent/env";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import { createWorldCupAgent, type WorldCupAgent } from "@golazo/agent";

export const maxDuration = 300;

// One agent per server instance: model is probed once, MemorySaver keeps
// per-thread conversation state in memory.
let agentPromise: Promise<WorldCupAgent> | null = null;
function getAgent(): Promise<WorldCupAgent> {
  agentPromise ??= createWorldCupAgent();
  return agentPromise;
}

function chunkText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string" ? part : "text" in part ? String(part.text ?? "") : ""
      )
      .join("");
  }
  return "";
}

export async function POST(req: Request) {
  const input = (await req.json()) as RunAgentInput;
  const encoder = new EventEncoder({ accept: req.headers.get("accept") ?? undefined });
  const textEncoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BaseEvent | Record<string, unknown>) =>
        controller.enqueue(textEncoder.encode(encoder.encodeSSE(event as BaseEvent)));

      try {
        send({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId });

        const agent = await getAgent();
        // The agent's checkpointer holds prior turns for this thread, so only
        // the newest user message is forwarded.
        const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
        const userText =
          typeof lastUser?.content === "string" ? lastUser.content : "";

        const events = agent.streamEvents(
          { messages: [{ role: "user", content: userText }] },
          {
            version: "v2",
            configurable: { thread_id: input.threadId },
          }
        );

        let messageId: string | null = null;
        for await (const ev of events) {
          if (ev.event === "on_chat_model_stream") {
            const delta = chunkText(ev.data.chunk?.content);
            if (delta) {
              if (!messageId) {
                messageId = crypto.randomUUID();
                send({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
              }
              send({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta });
            }
          } else if (ev.event === "on_chat_model_end") {
            if (messageId) {
              send({ type: EventType.TEXT_MESSAGE_END, messageId });
              messageId = null;
            }
            // Tool calls are complete at model end; emit them as a unit.
            const toolCalls = ev.data.output?.tool_calls ?? [];
            for (const tc of toolCalls) {
              const toolCallId = tc.id ?? crypto.randomUUID();
              send({
                type: EventType.TOOL_CALL_START,
                toolCallId,
                toolCallName: tc.name,
              });
              send({
                type: EventType.TOOL_CALL_ARGS,
                toolCallId,
                delta: JSON.stringify(tc.args ?? {}),
              });
              send({ type: EventType.TOOL_CALL_END, toolCallId });
            }
          } else if (ev.event === "on_tool_end") {
            const output = ev.data.output;
            const content =
              typeof output?.content === "string"
                ? output.content
                : JSON.stringify(output?.content ?? output ?? "");
            send({
              type: EventType.TOOL_CALL_RESULT,
              messageId: crypto.randomUUID(),
              toolCallId: output?.tool_call_id ?? ev.run_id,
              content,
              role: "tool",
            });
          }
        }

        send({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
      } catch (err) {
        console.error(`[agent] run ${input.runId} failed:`, err);
        send({
          type: EventType.RUN_ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": encoder.getContentType(),
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
