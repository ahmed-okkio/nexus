import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { db } from "@/lib/db";
import { createNote, createNotes, getNotes } from "@/lib/tools/notes";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Persist user message
  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage.role === "user") {
    await db.message.create({
      data: {
        role: "user",
        content: lastUserMessage.content,
      },
    });
  }

  const result = streamText({
    model: google("gemini-1.5-flash"),
    messages,
    system: `You are Nexus, a personal AI assistant. 
    You help users manage notes and tasks.
    Be concise, helpful, and conversational.
    
    Current Date: ${new Date().toLocaleDateString()}
    `,
    onFinish: async ({ text }) => {
      // Persist assistant message
      await db.message.create({
        data: {
          role: "assistant",
          content: text,
        },
      });
    },
    maxSteps: 5,
    // Tools will be registered here by Groovster and Okkio
    tools: {
      createNote,
      createNotes,
      getNotes,
    },
  });

  return result.toDataStreamResponse();
}
