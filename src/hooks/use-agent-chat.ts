"use client";

import { useMutation } from "@tanstack/react-query";

export interface ChatTurn {
  message_id?: string;
  role: string;
  content?: string;
  name?: string;
  arguments?: string;
  result?: string;
}

async function post<T>(url: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = fallback;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export function useStartChat(agentId: string, locationId: string) {
  return useMutation({
    mutationFn: (dynamicVariables?: Record<string, string>) =>
      post<{ chat_id: string }>(
        `/api/retell/agents/${agentId}/chat`,
        { locationId, dynamicVariables },
        "Failed to start chat"
      ),
  });
}

export function useChatCompletion(agentId: string, locationId: string) {
  return useMutation({
    mutationFn: ({ chatId, content }: { chatId: string; content: string }) =>
      post<{ messages: ChatTurn[] }>(
        `/api/retell/agents/${agentId}/chat/completion`,
        { locationId, chatId, content },
        "Failed to get a reply"
      ),
  });
}
