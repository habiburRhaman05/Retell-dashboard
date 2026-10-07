"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Phone, PhoneOff, Loader2, Mic, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateWebCall } from "@/hooks/use-web-call";

type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

interface TranscriptLine {
  role: "agent" | "user" | string;
  content: string;
}

// Loaded lazily in the browser only - the SDK touches WebRTC globals that
// don't exist during SSR.
type RetellWebClientInstance = {
  startCall: (config: {
    accessToken: string;
    sampleRate?: number;
    emitRawAudioSamples?: boolean;
  }) => Promise<void>;
  stopCall: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function TestCallPanel({
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
  const createWebCall = useCreateWebCall(agentId, locationId);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [agentTalking, setAgentTalking] = useState(false);
  const clientRef = useRef<RetellWebClientInstance | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const cleanup = useCallback(() => {
    try {
      clientRef.current?.stopCall();
    } catch {
      // already stopped
    }
    clientRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startCall = async () => {
    setErrorMessage(null);
    setTranscript([]);
    setStatus("connecting");

    try {
      const { access_token } = await createWebCall.mutateAsync();

      const { RetellWebClient } = await import("retell-client-js-sdk");
      const client = new RetellWebClient() as unknown as RetellWebClientInstance;
      clientRef.current = client;

      client.on("call_started", () => setStatus("live"));
      client.on("call_ended", () => {
        setStatus("ended");
        clientRef.current = null;
      });
      client.on("error", (...args: unknown[]) => {
        const err = args[0];
        setErrorMessage(
          err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "The call disconnected unexpectedly"
        );
        setStatus("error");
        cleanup();
      });
      client.on("agent_start_talking", () => setAgentTalking(true));
      client.on("agent_stop_talking", () => setAgentTalking(false));
      client.on("update", (...args: unknown[]) => {
        const update = args[0] as { transcript?: TranscriptLine[] } | undefined;
        if (update?.transcript) setTranscript(update.transcript);
      });

      await client.startCall({
        accessToken: access_token,
        sampleRate: 24000,
        emitRawAudioSamples: false,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Microphone access was denied. Allow microphone access in your browser and try again."
            : err.message
          : "Failed to start the test call";
      setErrorMessage(message);
      setStatus("error");
      cleanup();
    }
  };

  const endCall = () => {
    cleanup();
    setStatus("ended");
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Test Call</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">
              {agentName || "Unnamed Agent"}
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[200px]">
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                <Mic className="w-6 h-6 text-brand-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Talk to this agent right in your browser</p>
              <p className="text-xs text-gray-400">
                You&apos;ll be asked for microphone access when you start
              </p>
            </div>
          )}

          {status === "connecting" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Connecting...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm text-red-600 font-medium">Call failed</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">{errorMessage}</p>
            </div>
          )}

          {(status === "live" || status === "ended") && (
            <div>
              {status === "live" && (
                <div className="flex items-center justify-center gap-2 mb-4 py-3">
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      agentTalking ? "bg-brand-500 animate-pulse" : "bg-gray-300"
                    )}
                  />
                  <span className="text-xs text-gray-500">
                    {agentTalking ? "Agent is speaking..." : "Listening..."}
                  </span>
                </div>
              )}

              {transcript.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  {status === "live"
                    ? "Transcript will appear here as you talk"
                    : "No transcript captured"}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {transcript.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        line.role === "agent" ? "justify-start" : "justify-end"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] px-3 py-2 rounded-lg text-[13px] leading-relaxed",
                          line.role === "agent"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-brand-500 text-white"
                        )}
                      >
                        {line.content}
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}

              {status === "ended" && (
                <p className="text-xs text-gray-400 text-center mt-4">Call ended</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl shrink-0">
          {status === "live" ? (
            <button
              onClick={endCall}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </button>
          ) : (
            <button
              onClick={startCall}
              disabled={status === "connecting"}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "connecting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
              {status === "connecting"
                ? "Connecting..."
                : status === "ended" || status === "error"
                ? "Call Again"
                : "Start Test Call"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
