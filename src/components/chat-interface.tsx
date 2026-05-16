"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { Send, User, Bot, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  [index: number]: RecognitionAlternative;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: RecognitionResult;
    length: number;
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognitionLike;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionLike;
    };
  }
}

const TOOL_RESULT_MESSAGES: Record<string, string> = {
  createNote: "Note created.",
  createNotes: "Notes created.",
  getNotes: "Notes loaded.",
  createTask: "Task created.",
  getTasks: "Tasks loaded.",
  searchTasks: "Task search completed.",
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported] = useState(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Handle updates by watching messages for tool results
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    const hasTaskResult = lastMessage.parts.some(p => 
      isToolUIPart(p) && p.state === 'output-available' && 
      ['createTask', 'toggleTask', 'deleteTask', 'updateTask', 'convertNoteToTask'].includes(getToolName(p))
    );
    const hasNoteResult = lastMessage.parts.some(p => 
      isToolUIPart(p) && p.state === 'output-available' && 
      ['createNote', 'createNotes', 'deleteNote', 'updateNote'].includes(getToolName(p))
    );
    const hasBriefingResult = lastMessage.parts.some(p => 
      isToolUIPart(p) && p.state === 'output-available' && 
      getToolName(p) === 'getDailyBriefing'
    );

    if (hasTaskResult) window.dispatchEvent(new CustomEvent("tasks-updated"));
    if (hasNoteResult) window.dispatchEvent(new CustomEvent("notes-updated"));
    if (hasBriefingResult) window.dispatchEvent(new CustomEvent("show-briefing"));
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputValue(transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: { error: string }) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const onHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const text = inputValue;
    setInputValue(""); 
    if (isListening) recognitionRef.current?.stop();
    await sendMessage({ text });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-transparent">
      <div className="flex items-center justify-center border-b border-zinc-200/70 bg-white/70 px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-900/65 dark:text-zinc-300">
        Nexus
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-linear-to-b from-white/25 to-transparent p-5 dark:from-zinc-900/25">
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
                  "rounded-xl p-2",
                  m.role === "user"
                    ? "bg-zinc-200/70 text-zinc-700 dark:bg-zinc-700/80 dark:text-zinc-200"
                    : "bg-blue-100/70 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                )}
              >
                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "rounded-tr-none bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "rounded-tl-none border border-zinc-200/80 bg-white/95 text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800/80 dark:text-zinc-100"
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

      <form onSubmit={onHandleSubmit} className="flex gap-2 border-t border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-900/65">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isListening ? "Listening..." : "Ask anything..."}
          className={cn(
            "flex-1 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400/80 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100",
            isListening && "border-blue-500 ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-500/10"
          )}
        />
        <div className="flex gap-2">
          {isSpeechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "rounded-xl p-3 transition-colors",
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              )}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="rounded-xl bg-blue-600 p-3 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
