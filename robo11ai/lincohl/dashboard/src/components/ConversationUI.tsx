"use client";

import { useState, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { getConversationToken } from "@/lib/actions";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import LiveTranscript, { type TranscriptMessage } from "./LiveTranscript";
import { Mic, PhoneOff } from "lucide-react";

export default function ConversationUI() {
  const [error, setError] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<TranscriptMessage[]>([]);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[conversation] connected");
      setError(null);
    },
    onDisconnect: () => {
      console.log("[conversation] disconnected");
    },
    onError: (err) => {
      console.error("[conversation] error:", err);
      setError(String(err));
    },
    onMessage: (msg) => {
      console.log("[conversation] message:", msg);
      setLiveMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: msg.source === "user" ? "user" : "agent",
          text: msg.message,
        },
      ]);
    },
  });

  const { status, isSpeaking } = conversation;
  const isConnected = status === "connected";

  // Map conversation state to AgentState for BarVisualizer
  const agentState: AgentState | undefined =
    status === "connecting"
      ? "connecting"
      : !isConnected
        ? undefined
        : isSpeaking
          ? "speaking"
          : "listening";

  const startConversation = useCallback(async () => {
    try {
      setError(null);
      setLiveMessages([]);
      const url = await getConversationToken();
      await conversation.startSession({ signedUrl: url });
    } catch (e) {
      setError(String(e));
    }
  }, [conversation]);

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // already disconnected
    }
  }, [conversation]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Visualizer */}
      <BarVisualizer
        state={agentState}
        barCount={20}
        demo
        className="w-full h-28 rounded-xl"
      />

      {/* Status label */}
      {isConnected && (
        <span className="text-xs text-gray-400">
          {isSpeaking ? "Lincohl is speaking..." : "Listening..."}
        </span>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isConnected ? (
          <button
            onClick={startConversation}
            className="flex items-center gap-2 px-6 py-3 bg-lincohl-600 hover:bg-lincohl-700 rounded-full text-white font-medium transition-colors"
          >
            <Mic className="w-5 h-5" />
            Talk to Lincohl
          </button>
        ) : (
          <button
            onClick={endConversation}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white font-medium transition-colors"
          >
            <PhoneOff className="w-5 h-5" />
            End
          </button>
        )}
      </div>

      {/* Connection status */}
      <div className="text-center">
        <div className="text-sm text-gray-500">
          {status === "connecting" && "Connecting..."}
          {status === "connected" && "Connected via WebRTC"}
          {status === "disconnected" && "Ready"}
        </div>
        {error && (
          <div className="text-sm text-red-400 mt-1">{error}</div>
        )}
      </div>

      {/* Live transcript */}
      {liveMessages.length > 0 && (
        <div className="w-full border-t border-white/10 pt-4">
          <LiveTranscript messages={liveMessages} />
        </div>
      )}
    </div>
  );
}
