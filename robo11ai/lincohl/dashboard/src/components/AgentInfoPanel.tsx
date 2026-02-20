"use client";

import { Wrench, BookOpen, Zap } from "lucide-react";

interface AgentInfoPanelProps {
  toolIds: string[];
  knowledgeBase: Array<{ id: string; name: string; type: string }>;
  agentName: string;
  llm: string;
}

const KNOWN_TOOLS: Record<string, string> = {
  get_weather: "Weather",
  get_time: "World Time",
  web_search: "Web Search",
};

export default function AgentInfoPanel({
  toolIds,
  knowledgeBase,
  agentName,
  llm,
}: AgentInfoPanelProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        {agentName || "Agent"} Info
      </h2>

      {/* Model */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5" /> Model
        </h3>
        <p className="text-sm text-gray-300">{llm || "Default"}</p>
      </div>

      {/* Client Tools */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Wrench className="w-3.5 h-3.5" /> Client Tools ({toolIds.length})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {toolIds.map((id) => (
            <span
              key={id}
              className="px-2 py-1 bg-lincohl-700/20 border border-lincohl-600/30 rounded text-xs text-lincohl-300"
            >
              {KNOWN_TOOLS[id] || id}
            </span>
          ))}
          {toolIds.length === 0 && (
            <p className="text-xs text-gray-500">No client tools</p>
          )}
        </div>
      </div>

      {/* Knowledge Base */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3.5 h-3.5" /> Knowledge Base (
          {knowledgeBase.length})
        </h3>
        <div className="space-y-1">
          {knowledgeBase.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 text-xs text-gray-400"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-lincohl-500 shrink-0" />
              <span className="truncate">{doc.name}</span>
              <span className="text-gray-600 shrink-0">{doc.type}</span>
            </div>
          ))}
          {knowledgeBase.length === 0 && (
            <p className="text-xs text-gray-500">No documents</p>
          )}
        </div>
      </div>
    </div>
  );
}
