import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { db } from "@/lib/db";
import {
  createNote,
  createNotes,
  deleteNote,
  getNotes,
  searchNotes,
} from "@/lib/tools/notes";
import {
  createTask,
  getDailyBriefing,
  getSmartReminders,
  getTasks,
  toggleTask,
} from "@/lib/tools/tasks";

export const maxDuration = 30;

type HFChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: HFToolCall[];
};

type HFToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type HFToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

type HFChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: HFToolCall[];
    };
  }>;
  error?: string | { message?: string };
};

type ToolEvent = {
  id: string;
  name: string;
  args: unknown;
  result: unknown;
};

type AssistantResult = {
  text: string;
  toolEvents: ToolEvent[];
};

const SYSTEM_PROMPT = `You are Nexus, a personal AI assistant for the LOS Hackathon.
You help users manage notes and tasks.
Be concise, helpful, and conversational.

Use tools when the user asks to create, list, search, delete, update, or summarize notes or tasks.
When creating tasks, always use the user's input as the title, meaning the main task name. Use description only for additional details if provided separately.
After using tools, provide a short confirmation or summary.

PROACTIVE SUGGESTIONS (Note to Task):
Whenever a user creates a note or you retrieve notes, analyze the content for actionable items, such as "Buy groceries", "Schedule meeting", or "Email Bob".
If you find actionable items, suggest creating a task for them and ask for confirmation.

Current Date: ${new Date().toLocaleDateString()}`;

const GEMINI_SYSTEM_PROMPT = `You are Nexus, a personal AI assistant for the LOS Hackathon.
You help users manage notes and tasks.
Be concise, helpful, and conversational.

Use tools when the user asks to create, list, search, delete, update, or summarize notes or tasks.
When creating tasks, always use the user's input as the title, meaning the main task name. Use description only for additional details if provided separately.
After executing any tool, provide a short, single-sentence confirmation or summary message to the user immediately. Do not be silent.

PROACTIVE SUGGESTIONS (Note to Task):
Whenever a user creates a note or you retrieve notes, analyze the content for actionable items, such as "Buy groceries", "Schedule meeting", or "Email Bob".
If you find actionable items, suggest creating a task for them and ask for confirmation.

Current Date: ${new Date().toLocaleDateString()}`;

const HF_TOOLS: HFToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "createNote",
      description: "Create a single new note.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content of the note." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createNotes",
      description: "Create multiple new notes at once.",
      parameters: {
        type: "object",
        properties: {
          notes: {
            type: "array",
            items: { type: "string" },
            description: "The note contents to create.",
          },
        },
        required: ["notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getNotes",
      description: "Get all notes, ordered newest first.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "searchNotes",
      description: "Search for notes containing specific text.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for in notes." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteNote",
      description: "Delete a note by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The note ID to delete." },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a new task with an optional due date and description.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The task name or title." },
          description: {
            type: "string",
            description: "Optional detailed description or notes.",
          },
          dueDate: {
            type: "string",
            description: "Optional due date in ISO format, YYYY-MM-DD.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTasks",
      description: "Get tasks, optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "completed"],
            description: "Optional task status filter.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggleTask",
      description: "Update a task status to pending or completed.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The task ID." },
          status: {
            type: "string",
            enum: ["pending", "completed"],
            description: "The new task status.",
          },
        },
        required: ["id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDailyBriefing",
      description: "Get a summary of pending tasks and recent notes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getSmartReminders",
      description: "Get reminders for overdue and urgent pending tasks.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function getTextContent(message: UIMessage): string {
  const legacyContent = (message as { content?: unknown }).content;
  if (typeof legacyContent === "string") {
    return legacyContent;
  }

  return (
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("\n") || ""
  );
}

function toHFMessages(clientMessages: UIMessage[]): HFChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...clientMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: getTextContent(message),
      }))
      .filter((message) => message.content.trim().length > 0),
  ];
}

function parseToolArgs(toolCall: HFToolCall): Record<string, unknown> {
  if (!toolCall.function.arguments.trim()) {
    return {};
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Tool ${toolCall.function.name} received invalid arguments.`);
  }
  return parsed as Record<string, unknown>;
}

function getStringArg(
  args: Record<string, unknown>,
  name: string,
  required = true,
): string | undefined {
  const value = args[name];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (required) {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return undefined;
}

async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "createNote": {
      const note = await db.note.create({
        data: { content: getStringArg(args, "content")! },
      });
      return { success: true, note };
    }
    case "createNotes": {
      const notesArg = args.notes;
      if (
        !Array.isArray(notesArg) ||
        !notesArg.every((note) => typeof note === "string")
      ) {
        throw new Error("createNotes requires a notes array of strings.");
      }
      const notes = await Promise.all(
        notesArg.map((content) => db.note.create({ data: { content } })),
      );
      return { success: true, count: notes.length, notes };
    }
    case "getNotes": {
      const notes = await db.note.findMany({ orderBy: { createdAt: "desc" } });
      return { success: true, notes };
    }
    case "searchNotes": {
      const notes = await db.note.findMany({
        where: { content: { contains: getStringArg(args, "query")! } },
        orderBy: { createdAt: "desc" },
      });
      return { success: true, notes };
    }
    case "deleteNote": {
      const id = getStringArg(args, "id")!;
      await db.note.delete({ where: { id } });
      return { success: true, message: `Note ${id} deleted successfully.` };
    }
    case "createTask": {
      const dueDate = getStringArg(args, "dueDate", false);
      const task = await db.task.create({
        data: {
          title: getStringArg(args, "title")!,
          description: getStringArg(args, "description", false),
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
      });
      return { success: true, task };
    }
    case "getTasks": {
      const status = getStringArg(args, "status", false);
      if (status && status !== "pending" && status !== "completed") {
        throw new Error("status must be pending or completed.");
      }
      const tasks = await db.task.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return { success: true, tasks, count: tasks.length };
    }
    case "toggleTask": {
      const status = getStringArg(args, "status")!;
      if (status !== "pending" && status !== "completed") {
        throw new Error("status must be pending or completed.");
      }
      const task = await db.task.update({
        where: { id: getStringArg(args, "id")! },
        data: { status },
      });
      return { success: true, task };
    }
    case "getDailyBriefing": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const tasks = await db.task.findMany({
        where: { status: "pending" },
        orderBy: { dueDate: "asc" },
      });
      const overdue = tasks.filter((task) => task.dueDate && task.dueDate < today);
      const dueToday = tasks.filter(
        (task) =>
          task.dueDate && task.dueDate >= today && task.dueDate < tomorrow,
      );
      const recentNotes = await db.note.findMany({
        where: { createdAt: { gte: twentyFourHoursAgo } },
        orderBy: { createdAt: "desc" },
      });

      return {
        success: true,
        summary: {
          overdueCount: overdue.length,
          dueTodayCount: dueToday.length,
          recentNotesCount: recentNotes.length,
        },
        data: { overdue, dueToday, recentNotes },
      };
    }
    case "getSmartReminders": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pendingTasks = await db.task.findMany({
        where: { status: "pending" },
        orderBy: { dueDate: "asc" },
      });
      const overdue = pendingTasks.filter(
        (task) => task.dueDate && task.dueDate < today,
      );
      const urgent = pendingTasks.filter((task) => {
        if (!task.dueDate) return false;
        const daysUntilDue = Math.ceil(
          (task.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysUntilDue <= 1 && daysUntilDue >= 0;
      });

      return {
        success: true,
        hasReminders: overdue.length > 0 || urgent.length > 0,
        reminders: [
          ...(overdue.length
            ? [{ type: "overdue", priority: "critical", tasks: overdue.slice(0, 3) }]
            : []),
          ...(urgent.length ? [{ type: "urgent", priority: "high", tasks: urgent }] : []),
        ],
        totalPending: pendingTasks.length,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function requestHuggingFace(messages: HFChatMessage[]) {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_MODEL || "Qwen/Qwen2.5-7B-Instruct";

  if (!token) {
    return {
      choices: [
        {
          message: {
            content:
              "Hugging Face is not configured yet. Add HF_TOKEN to your .env file, then restart the dev server.",
          },
        },
      ],
    } satisfies HFChatCompletionResponse;
  }

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: HF_TOOLS,
      tool_choice: "auto",
      max_tokens: 500,
      temperature: 0.4,
    }),
  });

  const payload = (await response.json()) as HFChatCompletionResponse;

  if (!response.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message ||
          `Hugging Face request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function getHuggingFaceAssistantResult(
  initialMessages: HFChatMessage[],
): Promise<AssistantResult> {
  const messages = [...initialMessages];
  const toolEvents: ToolEvent[] = [];

  for (let step = 0; step < 4; step += 1) {
    const payload = await requestHuggingFace(messages);
    const message = payload.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];

    if (toolCalls.length === 0) {
      return {
        text:
          message?.content?.trim() ||
          (toolEvents.length > 0
            ? "Done."
            : "I did not receive a response from Hugging Face."),
        toolEvents,
      };
    }

    messages.push({
      role: "assistant",
      content: message?.content || null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const args = parseToolArgs(toolCall);
      const result = await executeTool(toolCall.function.name, args);

      toolEvents.push({
        id: toolCall.id,
        name: toolCall.function.name,
        args,
        result,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    text: "I ran the requested tools, but the model did not produce a final response.",
    toolEvents,
  };
}

function assistantResponse(resultPromise: Promise<AssistantResult>) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const textId = crypto.randomUUID();
      const { text, toolEvents } = await resultPromise;

      writer.write({ type: "start" });
      for (const event of toolEvents) {
        writer.write({
          type: "tool-input-available",
          toolCallId: event.id,
          toolName: event.name,
          input: event.args,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId: event.id,
          output: event.result,
        });
      }
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function persistAssistantMessage(text: string) {
  try {
    await db.message.create({
      data: {
        role: "assistant",
        content: text,
      },
    });
  } catch (dbError) {
    console.error("Database error persisting assistant message:", dbError);
  }
}

async function handleHuggingFaceChat(clientMessages: UIMessage[]) {
  console.log("Chat API route hit. Processing Hugging Face request...");

  const assistantResultPromise = getHuggingFaceAssistantResult(
    toHFMessages(clientMessages),
  ).then(async (result) => {
    console.log("Hugging Face response received:", result.text);
    await persistAssistantMessage(result.text);
    return result;
  });

  return assistantResponse(assistantResultPromise);
}

async function handleGeminiChat(clientMessages: UIMessage[]) {
  console.log("Chat API route hit. Processing Gemini request...");

  const messages = await convertToModelMessages(clientMessages);
  const result = streamText({
    model: google(process.env.GEMINI_MODEL || "gemini-flash-lite-latest"),
    messages,
    stopWhen: stepCountIs(5),
    system: GEMINI_SYSTEM_PROMPT,
    onFinish: async ({ text }) => {
      console.log("Gemini response received:", text);
      await persistAssistantMessage(text || "");
    },
    onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
      console.log("=== GEMINI STEP ===", {
        finishReason,
        hasText: !!text,
        text: text?.slice(0, 100),
        tools: toolCalls?.map((toolCall) => toolCall.toolName),
      });
      if (toolCalls && toolCalls.length > 0) {
        console.log(
          "Tools called:",
          toolCalls.map((toolCall) => toolCall.toolName).join(", "),
        );
      }
      if (toolResults && toolResults.length > 0) {
        console.log(
          "Tool results received:",
          toolResults.map((toolResult) => toolResult.toolName).join(", "),
        );
      }
    },
    tools: {
      createNote,
      createNotes,
      getNotes,
      searchNotes,
      deleteNote,
      createTask,
      getTasks,
      toggleTask,
      getDailyBriefing,
      getSmartReminders,
    },
  });

  return result.toUIMessageStreamResponse();
}

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

    const lastUserMessage = clientMessages[clientMessages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      const contentString = getTextContent(lastUserMessage);

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

    const provider = (process.env.AI_PROVIDER || "huggingface").toLowerCase();

    if (provider === "gemini") {
      return handleGeminiChat(clientMessages);
    }

    if (provider !== "huggingface") {
      return new Response(
        JSON.stringify({
          error: `Unsupported AI_PROVIDER "${provider}". Use "huggingface" or "gemini".`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return handleHuggingFaceChat(clientMessages);
  } catch (error) {
    console.error("Chat API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
