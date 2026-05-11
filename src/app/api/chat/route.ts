import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { db } from "@/lib/db";
import { createNote, createNotes, getNotes } from "@/lib/tools/notes";
import { createTask, getTasks, toggleTask, getDailyBriefing, getSmartReminders } from "@/lib/tools/tasks";

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
    model: google("gemini-2.0-flash-exp"),
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
    tools: {
      createNote,
      createNotes,
      getNotes,
      createTask,
      getTasks,
      toggleTask,
      getDailyBriefing,
      getSmartReminders,
    },
  });

  return result.toTextStreamResponse();
}
