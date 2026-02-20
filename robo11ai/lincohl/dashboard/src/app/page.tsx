"use client";

import { useState, useEffect, useCallback } from "react";
import ConversationUI from "@/components/ConversationUI";
import DevicePanel from "@/components/DevicePanel";
import EventFeed from "@/components/EventFeed";
import ConversationHistory from "@/components/ConversationHistory";
import McpManager from "@/components/McpManager";
import PersonalityManager from "@/components/PersonalityManager";
import AgentInfoPanel from "@/components/AgentInfoPanel";
import { Settings } from "lucide-react";
import {
  connectSync,
  fetchDevices,
  fetchConversations,
  type DeviceStatus,
  type SyncEvent,
  type ConversationRecord,
} from "@/lib/sync";

interface AgentConfig {
  name: string;
  system_prompt: string;
  llm: string;
  native_mcp_server_ids: string[];
  voice_id: string;
  temperature: number;
  tool_ids: string[];
  built_in_tools: Record<string, unknown>;
  knowledge_base: Array<{ id: string; name: string; type: string }>;
}

export default function Dashboard() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [syncConnected, setSyncConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"talk" | "config">("talk");
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);

  // Load initial data
  useEffect(() => {
    fetchDevices().then(setDevices);
    fetchConversations(20).then(setConversations);
    loadAgentConfig();
  }, []);

  async function loadAgentConfig() {
    try {
      const res = await fetch("/api/agent");
      if (res.ok) {
        const data = await res.json();
        setAgentConfig(data);
      }
    } catch {
      console.error("Failed to load agent config");
    }
  }

  async function patchAgent(updates: Record<string, any>) {
    const res = await fetch("/api/agent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "PATCH failed");
    }
    // Reload config
    await loadAgentConfig();
  }

  // WebSocket sync
  useEffect(() => {
    const disconnect = connectSync(
      (event) => {
        setEvents((prev) => [event, ...prev].slice(0, 100));
        setSyncConnected(true);

        if (event.device) {
          setDevices((prev) => {
            const idx = prev.findIndex((d) => d.device === event.device);
            const statusMap: Record<string, string> = {
              hotword_detected: "listening",
              conversation_started: "active",
              conversation_ended: "idle",
              user_transcript: "active",
              agent_response: "active",
            };
            const newStatus = statusMap[event.type] || "idle";
            const updated: DeviceStatus = {
              device: event.device,
              status: newStatus,
              last_seen: event.timestamp,
            };
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        }

        if (event.type === "conversation_ended") {
          fetchConversations(20).then(setConversations);
        }
      },
      (initialDevices) => {
        setDevices(initialDevices);
        setSyncConnected(true);
      }
    );

    return disconnect;
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lincohl</h1>
          <p className="text-sm text-gray-500">Voice AI Assistant</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Tab switcher */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("talk")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === "talk"
                  ? "bg-lincohl-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Talk
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                activeTab === "config"
                  ? "bg-lincohl-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Settings className="w-3 h-3" />
              Configure
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                syncConnected ? "bg-green-400" : "bg-gray-600"
              }`}
            />
            <span className="text-xs text-gray-500">
              {syncConnected ? "Sync" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {activeTab === "talk" ? (
        /* ==================== TALK TAB ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sidebar: devices + event feed */}
          <div className="lg:col-span-3 space-y-6">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <DevicePanel devices={devices} />
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <EventFeed events={events} />
            </div>
          </div>

          {/* Center: conversation orb */}
          <div className="lg:col-span-5">
            <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center min-h-[400px]">
              <ConversationUI />
            </div>
          </div>

          {/* Right sidebar: conversation history */}
          <div className="lg:col-span-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 h-full max-h-[600px]">
              <ConversationHistory
                conversations={conversations}
                selectedId={selectedConvId}
                onSelect={setSelectedConvId}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ==================== CONFIG TAB ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personality / System Prompt */}
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
            {agentConfig ? (
              <PersonalityManager
                currentPrompt={agentConfig.system_prompt}
                currentVoice={agentConfig.voice_id}
                currentTemp={agentConfig.temperature}
                onUpdate={async (data) => {
                  await patchAgent(data);
                }}
              />
            ) : (
              <div className="text-sm text-gray-500">Loading agent config...</div>
            )}
          </div>

          {/* MCP Servers */}
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
            {agentConfig ? (
              <McpManager
                activeMcps={agentConfig.native_mcp_server_ids}
                onUpdate={async (mcps) => {
                  await patchAgent({ native_mcp_server_ids: mcps });
                }}
              />
            ) : (
              <div className="text-sm text-gray-500">Loading agent config...</div>
            )}
          </div>

          {/* Agent Info */}
          <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
            {agentConfig ? (
              <AgentInfoPanel
                toolIds={agentConfig.tool_ids}
                knowledgeBase={agentConfig.knowledge_base}
                agentName={agentConfig.name}
                llm={agentConfig.llm}
              />
            ) : (
              <div className="text-sm text-gray-500">Loading agent config...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
