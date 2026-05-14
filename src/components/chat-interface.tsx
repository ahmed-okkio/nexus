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
          placeholder={isListening ? "Listening..." : "Ask anything..."}
          className={cn(
            "flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all",
            isListening && "border-blue-500 ring-2 ring-blue-500 bg-blue-50"
          )}
        />
        <div className="flex gap-2">
          {isSpeechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "p-2 rounded-full transition-colors",
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
              )}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
