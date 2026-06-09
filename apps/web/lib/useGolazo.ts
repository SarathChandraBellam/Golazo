"use client";

import { HttpAgent } from "@ag-ui/client";
import type { Message } from "@ag-ui/core";
import { useCallback, useRef, useState } from "react";

export interface GolazoChat {
  messages: Message[];
  running: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
}

/** Chat state backed by an AG-UI HttpAgent talking to /api/agent. */
export function useGolazo(): GolazoChat {
  const agentRef = useRef<HttpAgent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (text: string) => {
    agentRef.current ??= new HttpAgent({
      url: "/api/agent",
      threadId: crypto.randomUUID(),
      // HttpAgent calls its fetch as `this.fetch(...)`, which detaches the
      // built-in from `window` and throws "Illegal invocation" — re-bind it.
      fetch: (url, init) => globalThis.fetch(url, init),
    });
    const agent = agentRef.current;

    setError(null);
    agent.addMessages([{ id: crypto.randomUUID(), role: "user", content: text }]);
    setMessages([...agent.messages]);
    setRunning(true);
    try {
      await agent.runAgent(undefined, {
        onEvent: () => {
          setMessages([...agent.messages]);
        },
        onRunErrorEvent: ({ event }) => {
          setError(event.message ?? "The run failed.");
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMessages([...agent.messages]);
      setRunning(false);
    }
  }, []);

  return { messages, running, error, send };
}
