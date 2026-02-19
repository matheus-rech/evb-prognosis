"use client";

import type { SyncEvent } from "@/lib/sync";
import { Radio, MessageSquare, Mic, Bot } from "lucide-react";

const eventIcons: Record<string, React.ReactNode> = {
  hotword_detected: <Radio className="w-3.5 h-3.5 text-yellow-400" />,
  conversation_started: <Mic className="w-3.5 h-3.5 text-green-400" />,
  conversation_ended: <MessageSquare className="w-3.5 h-3.5 text-gray-400" />,
  user_transcript: <Mic className="w-3.5 h-3.5 text-blue-400" />,
  agent_response: <Bot className="w-3.5 h-3.5 text-lincohl-400" />,
};

interface EventFeedProps {
  events: SyncEvent[];
}

export default function EventFeed({ events }: EventFeedProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Live Feed
      </h2>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {events.length === 0 && (
          <p className="text-sm text-gray-500">Waiting for events...</p>
        )}
        {events.map((ev, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-sm p-1.5 rounded hover:bg-white/5"
          >
            <div className="mt-0.5 shrink-0">
              {eventIcons[ev.type] || <Radio className="w-3.5 h-3.5 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-gray-300">
                {ev.type === "user_transcript" && (ev.data as any)?.text}
                {ev.type === "agent_response" && (ev.data as any)?.text}
                {ev.type === "hotword_detected" && "Wake word detected"}
                {ev.type === "conversation_started" && "Conversation started"}
                {ev.type === "conversation_ended" && "Conversation ended"}
                {!["user_transcript", "agent_response", "hotword_detected", "conversation_started", "conversation_ended"].includes(ev.type) && ev.type}
              </span>
              <div className="text-xs text-gray-600">
                {ev.device} -- {new Date(ev.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
