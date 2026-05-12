import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { db } from "@/lib/db";
import { createNote, createNotes, getNotes, deleteNote } from "@/lib/tools/notes";
import { createTask, getTasks, toggleTask, getDailyBriefing, getSmartReminders } from "@/lib/tools/tasks";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clientMessages: UIMessage[] = body.messages || [];
    
    if (clientMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Incoming messages count:", clientMessages.length);

    const messages = await convertToModelMessages(clientMessages);

    // Persist user message
    const lastUserMessage = clientMessages[clientMessages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      // In v6, content can be complex (parts)
      const contentString = typeof lastUserMessage.content === "string" 
        ? lastUserMessage.content 
        : lastUserMessage.parts
            ?.filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("\n") || "";

      if (contentString) {
        try {
          await db.message.create({
            data: {
              role: "user",
              content: contentString,
            },
          });
        } catch (dbError) {
          console.error("Database error persisting user message:", dbError);
        }
      }
    }

    console.log("Chat API route hit. Processing request...");

    const result = streamText({
      model: google("gemini-flash-latest"),
      messages,
      maxSteps: 5,
      system: `You are Nexus, a personal AI assistant. 
      You help users manage notes and tasks.
      Be concise, helpful, and conversational.

      CRITICAL: After executing any tool (create, update, get, delete), you MUST provide a short, single-sentence confirmation or summary message to the user immediately. Do not be silent.
      
      If the user asks to delete or update something but you don't have the ID, call the 'get' tool first to find the relevant item and its ID, then proceed with the action.

      Current Date: ${new Date().toLocaleDateString()}
      `,
      onFinish: async ({ text }) => {
        console.log("Stream finished. Text content:", text);
        // Persist assistant message
        try {
          await db.message.create({
            data: {
              role: "assistant",
              content: text || "",
            },
          });
        } catch (dbError) {
          console.error("Database error persisting assistant message:", dbError);
        }
      },
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls && toolCalls.length > 0) {
          console.log("Tools called:", toolCalls.map(tc => tc.toolName).join(", "));
        }
        if (toolResults && toolResults.length > 0) {
          console.log("Tool results received:", toolResults.map(tr => tr.toolName).join(", "));
        }
      },
      tools: {
        createNote,
        createNotes,
        getNotes,
        deleteNote,
        createTask,
        getTasks,
        toggleTask,
        getDailyBriefing,
        getSmartReminders,
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
