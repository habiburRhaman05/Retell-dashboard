"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Loader2,
  Plus,
  RotateCcw,
  AlertCircle,
  Wrench,
  GitBranch,
  MessageSquare,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useStartChat,
  useChatCompletion,
  type ChatTurn,
} from "@/hooks/use-agent-chat";

interface VariableRow {
  id: number;
  key: string;
  value: string;
}

export function TestChatPanel({
  agentId,
  agentName,
  locationId,
  onClose,
}: {
  agentId: string;
  agentName: string;
  locationId: string;
  onClose: () => void;
}) {
  const startChat = useStartChat(agentId, locationId);
  const completion = useChatCompletion(agentId, locationId);

  const [chatId, setChatId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [showVars, setShowVars] = useState(false);
  const [vars, setVars] = useState<VariableRow[]>([]);
  const nextVarId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, completion.isPending]);

  const variablesObject = () =>
    Object.fromEntries(
      vars.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])
    );

  const resetChat = () => {
    setChatId(null);
    setTurns([]);
    setError(null);
    setLastSent(null);
    setInput("");
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || completion.isPending || startChat.isPending) return;
    setError(null);
    setLastSent(content);
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content }]);

    try {
      let id = chatId;
      if (!id) {
        const chat = await startChat.mutateAsync(variablesObject());
        id = chat.chat_id;
        setChatId(id);
      }
      const result = await completion.mutateAsync({ chatId: id, content });
      setTurns((prev) => [...prev, ...(result.messages ?? [])]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  };

  const retry = () => {
    if (!lastSent) return;
    // Drop the user turn that never got a reply, then resend it.
    setTurns((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "user") {
          copy.splice(i, 1);
          break;
        }
      }
      return copy;
    });
    void send(lastSent);
  };

  const busy = completion.isPending || startChat.isPending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[460px] h-full bg-white shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-gray-200 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-gray-900 leading-tight">Test LLM</h2>
            <p className="text-[11px] text-gray-500 truncate">
              Text chat with {agentName || "this agent"}, no call needed
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            onClick={resetChat}
            disabled={busy || (turns.length === 0 && !chatId)}
          >
            New chat
          </Button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="border-b border-gray-100 shrink-0">
          <button
            onClick={() => setShowVars((v) => !v)}
            aria-expanded={showVars}
            className="w-full flex items-center justify-between px-5 py-2.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>
              Dynamic variables
              {vars.length > 0 && (
                <span className="ml-1.5 text-gray-400 font-normal">({vars.length})</span>
              )}
            </span>
            <ChevronDown
              className={cn("w-4 h-4 text-gray-400 transition-transform", showVars && "rotate-180")}
            />
          </button>
          {showVars && (
            <div className="px-5 pb-3 space-y-2">
              {chatId && (
                <p className="text-[11px] text-amber-600">
                  Variables apply to new chats. Press New chat to use changes.
                </p>
              )}
              {vars.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <input
                    value={v.key}
                    placeholder="name"
                    onChange={(e) =>
                      setVars((p) => p.map((x) => (x.id === v.id ? { ...x, key: e.target.value } : x)))
                    }
                    className="w-2/5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[12px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                  />
                  <input
                    value={v.value}
                    placeholder="value"
                    onChange={(e) =>
                      setVars((p) => p.map((x) => (x.id === v.id ? { ...x, value: e.target.value } : x)))
                    }
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[12px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                  />
                  <button
                    onClick={() => setVars((p) => p.filter((x) => x.id !== v.id))}
                    aria-label="Remove variable"
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={() =>
                  setVars((p) => [...p, { id: nextVarId.current++, key: "", value: "" }])
                }
              >
                Add variable
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/60">
          {turns.length === 0 && !busy && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Send a message to start</p>
              <p className="text-xs text-gray-500 mt-1">
                Try the agent as a caller would. Tool calls and flow steps show up in the chat.
              </p>
            </div>
          )}

          {turns.map((t, i) => (
            <TurnView key={t.message_id ?? i} turn={t} />
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-[12px] text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {startChat.isPending ? "Starting chat..." : "Agent is thinking..."}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-red-700">Could not get a reply</p>
                <p className="text-[12px] text-red-600 mt-0.5 break-words">{error}</p>
                {!chatId && (
                  <p className="text-[11px] text-red-500/80 mt-1">
                    Text chat may only be available for agents Retell allows in chat mode.
                  </p>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={retry}>
                Retry
              </Button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="px-4 py-3 border-t border-gray-200 bg-white shrink-0 flex items-end gap-2"
        >
          <textarea
            value={input}
            rows={1}
            placeholder="Type a message as the caller..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            className="flex-1 max-h-32 resize-none px-3 py-2 rounded-lg border border-gray-200 text-[13px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          />
          <Button type="submit" icon={Send} loading={busy} disabled={busy || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 text-white px-3.5 py-2 text-[13px] whitespace-pre-wrap break-words">
          {turn.content}
        </div>
      </div>
    );
  }

  if (turn.role === "agent") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white border border-gray-200 text-gray-800 px-3.5 py-2 text-[13px] whitespace-pre-wrap break-words shadow-sm">
          {turn.content}
        </div>
      </div>
    );
  }

  if (turn.role === "tool_call_invocation" || turn.role === "tool_call_result") {
    const isCall = turn.role === "tool_call_invocation";
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px]">
        <p className="flex items-center gap-1.5 font-medium text-gray-600">
          <Wrench className="w-3 h-3" />
          {isCall ? `Calling ${turn.name ?? "function"}` : "Function result"}
        </p>
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-gray-500 max-h-32 overflow-auto">
          {isCall ? turn.arguments : turn.content ?? turn.result}
        </pre>
      </div>
    );
  }

  return (
    <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
      <GitBranch className="w-3 h-3" />
      {turn.role.replace(/_/g, " ")}
      {turn.content ? `: ${turn.content}` : ""}
    </p>
  );
}
