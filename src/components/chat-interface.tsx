"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onToolCall: ({ toolCall }) => {
      if (['createTask', 'toggleTask'].includes(toolCall.toolName)) {
        console.log('Tool call completed:', toolCall.toolName);
        window.dispatchEvent(new CustomEvent("tasks-updated"));
      }
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
          const hasVisibleContent = (m.content && m.content.trim().length > 0) || 
                                   (m.parts && m.parts.some(p => p.type === 'text' || p.type === 'tool-call'));
          
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
                {m.parts && m.parts.length > 0 ? (
                  <div className="space-y-2">
                    {m.parts.map((part, i) => {
                      if (part.type === "text") return <div key={i}>{part.text}</div>;
                      if (part.type === "tool-call") {
                        return (
                          <div key={i} className="text-xs text-blue-500 italic flex items-center gap-1">
                            <Bot size={12} className="animate-spin" />
                            Working on: {part.toolName}...
                          </div>
                        );
                      }
                      if (part.type === "tool-result") {
                        return (
                          <div key={i} className="text-xs text-gray-500 italic">
                            Tool output received.
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  <span>{m.content || (m.role === 'assistant' ? '...' : '')}</span>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && !messages.some(m => m.role === 'assistant' && !m.content && m.parts?.some(p => p.type === 'tool-call')) && (
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
