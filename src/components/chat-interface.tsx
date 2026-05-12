"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { Send, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";

const TOOL_RESULT_MESSAGES: Record<string, string> = {
  createNote: "Note created.",
  createNotes: "Notes created.",
  getNotes: "Notes loaded.",
  createTask: "Task created.",
  getTasks: "Tasks loaded.",
  toggleTask: "Task updated.",
  getDailyBriefing: "Daily briefing loaded.",
  getSmartReminders: "Reminders loaded.",
};

function formatToolResultMessage(toolName: string) {
  const knownMessage = TOOL_RESULT_MESSAGES[toolName];
  if (knownMessage) return knownMessage;

  const words = toolName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ");
  const [verb, ...subjectWords] = words;
  const subject = subjectWords.join(" ") || "action";
  const label = subject.charAt(0).toUpperCase() + subject.slice(1);

  if (["create", "add"].includes(verb)) return `${label} created.`;
  if (["delete", "remove"].includes(verb)) return `${label} deleted.`;
  if (["update", "edit", "toggle"].includes(verb)) return `${label} updated.`;
  if (["get", "list", "fetch", "search"].includes(verb)) return `${label} loaded.`;

  return `${label} completed.`;
}

export function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onToolCall: ({ toolCall }) => {
      console.log('Tool call detected:', toolCall.toolName);
      
      // Update Notes if a note-related tool is called
      if (toolCall.toolName.toLowerCase().includes('note')) {
        mutate('/api/notes');
      }
      
      // Update Tasks if a task-related tool is called
      if (toolCall.toolName.toLowerCase().includes('task')) {
        mutate('/api/tasks');
      }

      window.dispatchEvent(new CustomEvent("tasks-updated"));
    }
  });
  
  const isLoading = status === "submitted" || status === "streaming";
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle task updates based on message analysis
  useEffect(() => {
    // Left empty intentionally, removing debug logic
  }, [messages]);

  const onHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const text = inputValue;
    setInputValue(""); 
    await sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl border rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-zinc-50 font-semibold flex items-center gap-2 text-zinc-700 font-inter">
        <Bot size={18} />
        Nexus Assistant
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-400 mt-10">
            <p>How can I help you today?</p>
          </div>
        )}
        {messages.map((m) => {
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-start gap-3",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-full",
                  m.role === "user" ? "bg-zinc-100" : "bg-blue-50"
                )}
              >
                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm",
                  m.role === "user"
                    ? "bg-zinc-900 text-white rounded-tr-none"
                    : "bg-zinc-100 text-zinc-800 rounded-tl-none"
                )}
              >
                {m.parts.length > 0 ? (
                  <div className="space-y-2">
                    {m.parts.map((part, i) => {
                      if (part.type === "text") return <div key={i}>{part.text}</div>;

                      if (isToolUIPart(part)) {
                        const toolName = getToolName(part);

                        if (part.state === "output-available") {
                          return (
                            <div key={i} className="text-xs text-gray-500 italic">
                              {formatToolResultMessage(toolName)}
                            </div>
                          );
                        }

                        if (part.state === "output-error") {
                          return (
                            <div key={i} className="text-xs text-red-500 italic">
                              Tool failed: {part.errorText}
                            </div>
                          );
                        }

                        return (
                          <div key={i} className="text-xs text-blue-500 italic flex items-center gap-1">
                            <Bot size={12} className="animate-spin" />
                            Working on: {toolName}...
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                ) : (
                  <span>{m.role === 'assistant' ? '...' : ''}</span>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && !messages.some(m => m.role === 'assistant' && m.parts.some(p => isToolUIPart(p) && p.state !== 'output-available')) && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs italic">
            <Bot size={14} className="animate-pulse" />
            Nexus is thinking...
          </div>
        )}
      </div>

      <form 
        onSubmit={onHandleSubmit}
        className="p-4 border-t bg-zinc-50 flex gap-2"
      >
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything..."
          className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
