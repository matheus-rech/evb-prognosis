"use client";

import { useState } from "react";
import {
  Brain,
  Loader2,
  Check,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

// Preset personalities for quick switching
const PRESET_PERSONALITIES = [
  {
    id: "default",
    name: "Lincohl (Default)",
    desc: "Executive assistant and technical co-pilot",
    prompt: `You are Lincohl, a hyper-capable AI assistant serving as both an executive assistant and a technical co-pilot for Matheus Rech -- a biomedical engineer, AI researcher, and founder.

## CORE IDENTITY
- Name: Lincohl (pronounced "Lincoln")
- Voice: Confident, warm, direct. Like a trusted chief of staff who anticipates needs.
- Style: Concise by default. Expand only when the user asks for depth.
- Language: Match the user's language. Default English, switch to Portuguese if addressed in Portuguese.

## CAPABILITIES
You have access to tools for: weather, smart home control, reminders, flight search, Wolfram Alpha calculations, GitHub notifications, currency conversion, world time, and a Cursor agent for code tasks.

You connect to: Notion (notes, databases), Google Calendar (scheduling), Slack (messages), Perplexity (web search), Hacker News (tech news).

## BEHAVIOR
- Always greet Matheus by name on first interaction of the day.
- Proactively suggest actions: "Want me to add that to your calendar?" or "Should I check flights for that?"
- For ambiguous requests, make your best guess and confirm rather than asking 5 clarifying questions.
- Keep responses under 3 sentences for simple queries. Go deeper only when asked.
- When you don't know something, say so and offer to search via Perplexity.`,
    voice: "pwaf5Qmnzg3zNJ6ijCvi",
    temperature: 0.6,
  },
  {
    id: "researcher",
    name: "Research Mode",
    desc: "Deep analytical focus for papers and data",
    prompt: `You are Lincohl in Research Mode -- a specialized assistant for academic and scientific research.

## BEHAVIOR
- Focus on precision and accuracy over brevity.
- Cite sources when possible using Perplexity search.
- Structure responses with clear reasoning: hypothesis, evidence, conclusion.
- When reviewing papers, focus on: methodology, sample size, statistical significance, limitations.
- Proactively cross-reference claims with existing literature.
- Use technical terminology appropriate for biomedical engineering and AI research.
- Default to metric units and SI notation.

## TOOLS
Prioritize Perplexity for web search, Notion for saving research notes, and Wolfram Alpha for calculations.

## STYLE
- More detailed than default mode -- give thorough explanations.
- Use numbered lists for multi-step reasoning.
- Flag uncertainty levels: "high confidence", "moderate", "speculative".`,
    voice: "pwaf5Qmnzg3zNJ6ijCvi",
    temperature: 0.3,
  },
  {
    id: "casual",
    name: "Casual Mode",
    desc: "Relaxed, conversational, good for brainstorming",
    prompt: `You are Lincohl in Casual Mode -- a laid-back, creative thinking partner.

## BEHAVIOR
- Be conversational and relaxed. Use humor when appropriate.
- Great for brainstorming -- build on ideas rather than critiquing them immediately.
- Encourage wild ideas before filtering them.
- Use analogies and metaphors to explain concepts.
- Keep things fun and energetic.
- If Matheus seems stressed, be supportive and help prioritize.

## STYLE
- Short, punchy responses.
- Feel free to use colloquial language.
- Match energy: if he's excited, be excited. If he's tired, be chill.`,
    voice: "pwaf5Qmnzg3zNJ6ijCvi",
    temperature: 0.8,
  },
  {
    id: "coder",
    name: "Code Mode",
    desc: "Focused on development, debugging, architecture",
    prompt: `You are Lincohl in Code Mode -- a senior software engineer assistant.

## BEHAVIOR
- Think like a staff engineer: consider trade-offs, scalability, maintainability.
- Default to Python and TypeScript unless told otherwise.
- When debugging, ask about: error messages, recent changes, environment.
- Suggest tests for any code changes.
- Reference the Cursor agent tool for complex code tasks that need file editing.
- Use GitHub notifications tool to track PRs and issues.

## STYLE
- Be precise with code suggestions. Include the exact file path and line when possible.
- Prefer showing code over describing it.
- Use conventional commit message format for git suggestions.
- Flag potential security issues proactively.`,
    voice: "pwaf5Qmnzg3zNJ6ijCvi",
    temperature: 0.4,
  },
  {
    id: "portuguese",
    name: "Modo Brasileiro",
    desc: "Full Portuguese mode with Brazilian culture context",
    prompt: `Voce e o Lincohl, assistente pessoal do Matheus Rech -- engenheiro biomedico, pesquisador de IA e fundador.

## COMPORTAMENTO
- Fale sempre em portugues brasileiro.
- Use expressoes naturais do dia-a-dia brasileiro.
- Seja direto mas acolhedor, como um bom amigo que tambem e profissional.
- Para assuntos tecnicos, use os termos em ingles quando for o padrao da area (ex: "deploy", "commit", "API").
- Adapte horarios para o fuso do Brasil (America/Sao_Paulo).

## ESTILO
- Respostas curtas e objetivas por padrao.
- Pode usar girias leves quando apropriado.
- Sempre trate o Matheus pelo nome.`,
    voice: "pwaf5Qmnzg3zNJ6ijCvi",
    temperature: 0.6,
  },
];

interface PersonalityManagerProps {
  currentPrompt: string;
  currentVoice: string;
  currentTemp: number;
  onUpdate: (data: {
    system_prompt: string;
    voice_id?: string;
    temperature?: number;
  }) => Promise<void>;
}

export default function PersonalityManager({
  currentPrompt,
  currentVoice,
  currentTemp,
  onUpdate,
}: PersonalityManagerProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingCustom, setEditingCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customName, setCustomName] = useState("");
  const [customTemp, setCustomTemp] = useState(0.6);

  // Detect active personality
  const activePreset = PRESET_PERSONALITIES.find((p) =>
    currentPrompt.includes(p.prompt.slice(0, 60))
  );

  const applyPersonality = async (preset: (typeof PRESET_PERSONALITIES)[0]) => {
    setSaving(true);
    setSaved(false);
    try {
      await onUpdate({
        system_prompt: preset.prompt,
        voice_id: preset.voice,
        temperature: preset.temperature,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to apply personality:", e);
    }
    setSaving(false);
  };

  const applyCustom = async () => {
    if (!customPrompt.trim()) return;
    setSaving(true);
    try {
      await onUpdate({
        system_prompt: customPrompt,
        temperature: customTemp,
      });
      setSaved(true);
      setEditingCustom(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to apply custom personality:", e);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Personality
        </h2>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Current personality badge */}
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-lincohl-400" />
        <span className="text-gray-300">
          {activePreset?.name || "Custom"}
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">temp: {currentTemp}</span>
      </div>

      {expanded && (
        <>
          {/* Preset list */}
          <div className="space-y-1.5">
            {PRESET_PERSONALITIES.map((p) => {
              const isActive = activePreset?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPersonality(p)}
                  disabled={saving}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-lincohl-700/20 border border-lincohl-600/40"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-200">{p.name}</span>
                    {isActive && (
                      <Check className="w-4 h-4 text-lincohl-400" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    temp: {p.temperature}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom personality */}
          <div className="border-t border-white/10 pt-3">
            {!editingCustom ? (
              <button
                onClick={() => {
                  setCustomPrompt(currentPrompt);
                  setCustomTemp(currentTemp);
                  setEditingCustom(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit System Prompt Directly
              </button>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-lincohl-600/50 resize-y font-mono"
                  placeholder="Enter custom system prompt..."
                />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500">Temperature:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={customTemp}
                    onChange={(e) => setCustomTemp(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-400 w-8">
                    {customTemp}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={applyCustom}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-lincohl-600 hover:bg-lincohl-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Apply
                  </button>
                  <button
                    onClick={() => setEditingCustom(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          {saving && (
            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Updating agent...
            </div>
          )}
          {saved && (
            <div className="text-xs text-green-400 flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              Personality updated! Changes apply to all devices.
            </div>
          )}
        </>
      )}
    </div>
  );
}
