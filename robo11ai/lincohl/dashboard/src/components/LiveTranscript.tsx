"use client";

import { Message, MessageContent } from "@/components/ui/message";
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation";

export interface TranscriptMessage {
  id: string;
  role: "user" | "agent";
  text: string;
}

interface LiveTranscriptProps {
  messages: TranscriptMessage[];
}

export default function LiveTranscript({ messages }: LiveTranscriptProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        Start a conversation to see the transcript
      </p>
    );
  }

  return (
    <Conversation className="h-full max-h-64">
      <ConversationContent className="p-2">
        {messages.map((m) => (
          <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
            <MessageContent variant={m.role === "user" ? "contained" : "flat"}>
              {m.text}
            </MessageContent>
          </Message>
        ))}
      </ConversationContent>
    </Conversation>
  );
}
