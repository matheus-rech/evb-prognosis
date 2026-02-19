"use server";

/**
 * Server action to generate a signed conversation token.
 * This keeps the API key on the server side.
 */
export async function getConversationToken(): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.NEXT_PUBLIC_AGENT_ID;

  if (!apiKey || !agentId) {
    throw new Error("Missing ELEVENLABS_API_KEY or NEXT_PUBLIC_AGENT_ID");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    {
      method: "GET",
      headers: { "xi-api-key": apiKey },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get signed URL: ${response.status}`);
  }

  const data = await response.json();
  return data.signed_url;
}
