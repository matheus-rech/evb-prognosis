"use client";

import { useState } from "react";
import { Plug, Plus, Trash2, Loader2, Check } from "lucide-react";

// All MCP servers available in ElevenLabs native integration
const AVAILABLE_MCP_SERVERS = [
  { id: "notion", name: "Notion", desc: "Read/write Notion pages, databases, search workspace" },
  { id: "gcalendar", name: "Google Calendar", desc: "View/create/update calendar events" },
  { id: "slack", name: "Slack", desc: "Send messages, read channels, search workspace" },
  { id: "perplexity", name: "Perplexity", desc: "Web search and research via Perplexity AI" },
  { id: "hackernews", name: "Hacker News", desc: "Browse top stories, comments, search" },
  { id: "gmail", name: "Gmail", desc: "Read/send emails, search inbox" },
  { id: "google_drive", name: "Google Drive", desc: "Read/search/manage files in Drive" },
  { id: "github", name: "GitHub", desc: "Repos, issues, PRs, code search" },
  { id: "linear", name: "Linear", desc: "Issues, projects, cycles, team management" },
  { id: "hubspot", name: "HubSpot", desc: "CRM contacts, deals, companies" },
  { id: "salesforce", name: "Salesforce", desc: "CRM records, reports, SOQL queries" },
  { id: "jira", name: "Jira", desc: "Issues, boards, sprints, projects" },
  { id: "confluence", name: "Confluence", desc: "Pages, spaces, search documentation" },
  { id: "airtable", name: "Airtable", desc: "Bases, tables, records, views" },
  { id: "todoist", name: "Todoist", desc: "Tasks, projects, labels, filters" },
  { id: "spotify", name: "Spotify", desc: "Playback control, playlists, search" },
  { id: "twilio", name: "Twilio", desc: "SMS, calls, phone number management" },
  { id: "stripe", name: "Stripe", desc: "Payments, customers, invoices" },
  { id: "shopify", name: "Shopify", desc: "Products, orders, customers, inventory" },
  { id: "intercom", name: "Intercom", desc: "Conversations, contacts, articles" },
  { id: "zendesk", name: "Zendesk", desc: "Tickets, users, organizations" },
];

interface McpManagerProps {
  activeMcps: string[];
  onUpdate: (mcps: string[]) => Promise<void>;
}

export default function McpManager({ activeMcps, onUpdate }: McpManagerProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localMcps, setLocalMcps] = useState<string[]>(activeMcps);
  const [search, setSearch] = useState("");

  const hasChanges =
    JSON.stringify([...localMcps].sort()) !==
    JSON.stringify([...activeMcps].sort());

  const filtered = AVAILABLE_MCP_SERVERS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.desc.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setLocalMcps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await onUpdate(localMcps);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to update MCPs:", e);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Plug className="w-4 h-4" />
          MCP Servers
        </h2>
        <span className="text-xs text-gray-500">
          {localMcps.length} active
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search integrations..."
        className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-lincohl-600/50"
      />

      {/* Server list */}
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {filtered.map((server) => {
          const isActive = localMcps.includes(server.id);
          return (
            <button
              key={server.id}
              onClick={() => toggle(server.id)}
              className={`w-full text-left p-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${
                isActive
                  ? "bg-lincohl-700/20 border border-lincohl-600/40"
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  isActive
                    ? "bg-lincohl-600/30 text-lincohl-300"
                    : "bg-white/5 text-gray-500"
                }`}
              >
                {server.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-200">{server.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {server.desc}
                </div>
              </div>
              {isActive && (
                <Check className="w-4 h-4 text-lincohl-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Save button */}
      {hasChanges && (
        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lincohl-600 hover:bg-lincohl-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Apply Changes"}
        </button>
      )}
    </div>
  );
}
