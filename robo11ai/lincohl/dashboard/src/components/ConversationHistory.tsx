"use client";

import { MessageSquare, User, Bot } from "lucide-react";
import type { ConversationRecord } from "@/lib/sync";

interface ConversationHistoryProps {
  conversations: ConversationRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationHistory({
  conversations,
  selectedId,
  onSelect,
}: ConversationHistoryProps) {
  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Conversations
      </h2>

      {/* List */}
      <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-sm text-gray-500">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
              selectedId === c.id
                ? "bg-lincohl-700/30 border border-lincohl-600/50"
                : "hover:bg-white/5 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate text-gray-300">
                {c.messages?.[0]?.text?.slice(0, 50) || c.id.slice(0, 12)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 pl-5">
              {c.device} -- {new Date(c.ended_at).toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      {/* Transcript */}
      {selected && (
        <div className="flex-1 overflow-y-auto space-y-2 border-t border-white/10 pt-3">
          {selected.messages.map((m, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <div className="shrink-0 mt-0.5">
                {m.role === "user" ? (
                  <User className="w-4 h-4 text-blue-400" />
                ) : (
                  <Bot className="w-4 h-4 text-lincohl-400" />
                )}
              </div>
              <div className="text-gray-300">{m.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
