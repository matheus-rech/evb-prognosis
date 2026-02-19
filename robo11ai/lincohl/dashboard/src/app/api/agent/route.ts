import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.ELEVENLABS_API_KEY!;
const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID!;
const BASE = "https://api.elevenlabs.io/v1";

/**
 * GET /api/agent -- fetch current agent config
 */
export async function GET() {
  const res = await fetch(`${BASE}/convai/agents/${AGENT_ID}`, {
    headers: { "xi-api-key": API_KEY },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `ElevenLabs API error: ${res.status}` },
      { status: res.status }
    );
  }

  const agent = await res.json();
  const prompt =
    agent.conversation_config?.agent?.prompt ?? {};
  const tts = agent.conversation_config?.tts ?? {};

  return NextResponse.json({
    name: agent.name,
    system_prompt: prompt.prompt ?? "",
    llm: prompt.llm ?? "",
    tool_ids: prompt.tool_ids ?? [],
    native_mcp_server_ids: prompt.native_mcp_server_ids ?? [],
    built_in_tools: prompt.built_in_tools ?? {},
    knowledge_base: prompt.knowledge_base ?? [],
    voice_id: tts.voice_id ?? "",
    turn_eagerness:
      agent.conversation_config?.turn?.turn_eagerness ?? "normal",
    temperature: prompt.temperature ?? 1,
  });
}

/**
 * PATCH /api/agent -- update agent config
 * Accepts partial updates to prompt, MCP, voice, etc.
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  // Build the nested payload ElevenLabs expects
  const payload: Record<string, any> = {};

  // Name
  if (body.name) {
    payload.name = body.name;
  }

  // Conversation config updates
  const convConfig: Record<string, any> = {};
  const agentConfig: Record<string, any> = {};
  const promptConfig: Record<string, any> = {};

  if (body.system_prompt !== undefined) {
    promptConfig.prompt = body.system_prompt;
  }
  if (body.native_mcp_server_ids !== undefined) {
    promptConfig.native_mcp_server_ids = body.native_mcp_server_ids;
  }
  if (body.temperature !== undefined) {
    promptConfig.temperature = body.temperature;
  }

  if (Object.keys(promptConfig).length > 0) {
    agentConfig.prompt = promptConfig;
  }
  if (Object.keys(agentConfig).length > 0) {
    convConfig.agent = agentConfig;
  }

  // Voice
  if (body.voice_id) {
    convConfig.tts = { voice_id: body.voice_id };
  }

  // Turn eagerness
  if (body.turn_eagerness) {
    convConfig.turn = { turn_eagerness: body.turn_eagerness };
  }

  if (Object.keys(convConfig).length > 0) {
    payload.conversation_config = convConfig;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const res = await fetch(`${BASE}/convai/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `ElevenLabs PATCH failed: ${res.status}`, details: text },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true });
}
