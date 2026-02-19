"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { getConversationToken } from "@/lib/actions";
import Orb from "./Orb";
import { Mic, MicOff, PhoneOff } from "lucide-react";

export default function ConversationUI() {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const volumeRef = useRef(0);
  const [volume, setVolume] = useState(0);

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
    },
  });

  const { status, isSpeaking } = conversation;
  const isConnected = status === "connected";

  // Poll volume
  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => {
      const v = isSpeaking
        ? conversation.getOutputVolume()
        : conversation.getInputVolume();
      volumeRef.current = v;
      setVolume(v);
    }, 50);
    return () => clearInterval(id);
  }, [isConnected, isSpeaking, conversation]);

  const startConversation = useCallback(async () => {
    try {
      setError(null);
      const url = await getConversationToken();
      setSignedUrl(url);
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
    <div className="flex flex-col items-center gap-6">
      {/* Orb */}
      <div className="relative">
        <Orb
          isActive={isConnected}
          isSpeaking={isSpeaking}
          volume={volume}
          size={240}
        />
        {isConnected && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className="text-xs text-gray-400 bg-black/60 px-2 py-0.5 rounded-full">
              {isSpeaking ? "Lincohl is speaking..." : "Listening..."}
            </span>
          </div>
        )}
      </div>

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

      {/* Status */}
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
    </div>
  );
}
