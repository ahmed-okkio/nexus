"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { AssistantOrb } from "@/components/ai-home/assistant-orb";
import { HudPanel } from "@/components/ai-home/hud-panel";
import { SidebarNav, type SidebarItem } from "@/components/ai-home/sidebar-nav";
import { VoiceDock } from "@/components/ai-home/voice-dock";
import { TasksList } from "@/components/tasks-list";
import { NotesList } from "@/components/notes-list";
import { DailyBriefing } from "@/components/daily-briefing";
import type { AiState, HudPanelData } from "@/components/ai-home/types";

type SpeechRecognitionType = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventType) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventType = {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionType;
  webkitSpeechRecognition?: new () => SpeechRecognitionType;
};

type Timeframe = "Today" | "Tomorrow" | "This Week";

type BriefingResponse = {
  success: boolean;
  summary: {
    overdueCount: number;
    dueTodayCount: number;
    recentNotesCount: number;
  };
  data: {
    overdue: Array<{ id: string; title: string; status: string; dueDate?: string }>;
    dueToday: Array<{ id: string; title: string; status: string; dueDate?: string }>;
    recentNotes: Array<{ id: string; content: string; createdAt: string }>;
  };
};

type TaskLite = {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  deletedAt?: string | null;
};

type NoteLite = {
  id: string;
  content: string;
  createdAt: string;
};

const extractCommandAfterWakeWord = (value: string, wakeWord = "nexus") => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  const lower = normalized.toLowerCase();
  const wakeIndex = lower.indexOf(wakeWord.toLowerCase());
  if (wakeIndex === -1) {
    return "";
  }
  return normalized.slice(wakeIndex + wakeWord.length).trim().replace(/^[,.:;\-\s]+/, "");
};

const panels: Record<AiState, HudPanelData[]> = {
  idle: [
    {
      id: "daily",
      title: "Morning Snapshot",
      badge: "Now",
      items: [
        { label: "2 tasks due today", sublabel: "One is high priority" },
        { label: "Meeting starts in 15 minutes", sublabel: "Design sync with product team" },
      ],
      action: "See full overview",
    },
  ],
  listening: [
    {
      id: "notes",
      title: "Recent Notes",
      badge: "3",
      items: [
        { label: "Launch prep notes", sublabel: "Edited 20m ago" },
        { label: "AI summary prompts", sublabel: "Updated this morning" },
      ],
      action: "Open notes",
    },
    {
      id: "messages",
      title: "Smart Reply Draft",
      badge: "AI",
      items: [
        { label: "Reply to David is ready", sublabel: "Tone: concise and confident" },
      ],
      action: "Review draft",
    },
  ],
  thinking: [
    {
      id: "calendar",
      title: "Calendar Context",
      badge: "Up Next",
      items: [
        { label: "Team standup at 9:30 AM", sublabel: "Prepare blockers summary" },
        { label: "Focus block at 11:00 AM", sublabel: "Deep work session protected" },
      ],
      action: "View schedule",
    },
  ],
  responding: [
    {
      id: "tasks",
      title: "Action Plan",
      badge: "5",
      items: [
        { label: "Finalize Q2 presentation", sublabel: "Due today" },
        { label: "Book NYC flights", sublabel: "Suggested 2 options under budget" },
      ],
      action: "Apply plan",
    },
    {
      id: "weather",
      title: "Environment",
      items: [
        { label: "72 deg and partly cloudy", sublabel: "Transit time is 18 min" },
      ],
      action: "Expand details",
    },
  ],
};
const NEXUS_VOICE_VOLUME = 0.38;

export default function Home() {
  const [state, setState] = useState<AiState>("idle");
  const [activeNav, setActiveNav] = useState<SidebarItem>("Home");
  const [timeframe, setTimeframe] = useState<Timeframe>("Today");
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [briefingData, setBriefingData] = useState<BriefingResponse | null>(null);
  const [snapshotCounts, setSnapshotCounts] = useState({ dueCount: 0, upcomingLabel: "No upcoming meetings", noteCount: 0 });
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [tasksCache, setTasksCache] = useState<TaskLite[]>([]);
  const [notesCache, setNotesCache] = useState<NoteLite[]>([]);
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
  });
  const [isListening, setIsListening] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceEnergy, setVoiceEnergy] = useState(0.25);
  const [transcript, setTranscript] = useState("");
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const commandRef = useRef("");
  const lastRawTranscriptRef = useRef("");
  const responseTimeoutRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const lastSpokenReplyRef = useRef("");
  const shouldKeepListeningRef = useRef(true);
  const isFinalizingCommandRef = useRef(false);
  const pauseRecognitionRef = useRef(false);
  const voiceActivityTimeoutRef = useRef<number | null>(null);
  const wakeDetectedRef = useRef(false);
  const workspacePanelRef = useRef<HTMLDivElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const activePanels = useMemo(() => {
    const base = panels[state];
    return base.map((panel) => {
      if (panel.id !== "daily") {
        return panel;
      }
      return {
        ...panel,
        badge: timeframe,
        items: [
          { label: `${snapshotCounts.dueCount} tasks due ${timeframe.toLowerCase()}`, sublabel: "AI-prioritized from your workspace" },
          { label: snapshotCounts.upcomingLabel, sublabel: `${snapshotCounts.noteCount} recent notes available` },
        ],
      };
    });
  }, [snapshotCounts, state, timeframe]);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const isChatLoading = status === "submitted" || status === "streaming";
  const assistantReply = useMemo(() => {
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    if (!lastAssistant) {
      return "";
    }
    return lastAssistant.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim();
  }, [messages]);

  const headlineText = useMemo(() => {
    if (isChatLoading && !assistantReply) {
      return "Thinking through your request...";
    }
    return assistantReply || "How can I help today?";
  }, [assistantReply, isChatLoading]);

  const setTransientStatus = (message: string) => {
    setStatusMessage(message);
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage("Ready");
    }, 2400);
  };

  const routeToNav = useCallback((item: SidebarItem) => {
    setActiveNav(item);
    setShowWorkspacePanel(item !== "Home");
    setTransientStatus(item === "Home" ? "Returned to assistant view" : `Opened ${item}`);
  }, []);

  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) {
      return;
    }
    const hasTaskResult = lastAssistant.parts.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "output-available" &&
        ["createTask", "toggleTask", "deleteTask", "updateTask", "convertNoteToTask"].includes(getToolName(part)),
    );
    const hasNoteResult = lastAssistant.parts.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "output-available" &&
        ["createNote", "createNotes", "deleteNote", "updateNote"].includes(getToolName(part)),
    );

    if (hasTaskResult) {
      window.dispatchEvent(new CustomEvent("tasks-updated"));
      window.setTimeout(() => routeToNav("Tasks"), 0);
    }
    if (hasNoteResult) {
      window.dispatchEvent(new CustomEvent("notes-updated"));
      window.setTimeout(() => routeToNav("Notes"), 0);
    }
  }, [messages, routeToNav]);

  const fetchSnapshotData = useCallback(async (activeTimeframe: Timeframe) => {
    try {
      const [briefingRes, tasksRes, notesRes] = await Promise.all([
        fetch("/api/tasks/briefing"),
        fetch("/api/tasks"),
        fetch("/api/notes"),
      ]);
      const briefingJson = (await briefingRes.json()) as BriefingResponse;
      const tasksJson = (await tasksRes.json()) as { tasks?: TaskLite[] };
      const notesJson = (await notesRes.json()) as { notes?: NoteLite[] };
      setBriefingData(briefingJson.success ? briefingJson : null);
      const tasks = (tasksJson.tasks ?? []).filter((task) => !task.deletedAt && task.status !== "completed");
      setTasksCache(tasksJson.tasks ?? []);
      setNotesCache(notesJson.notes ?? []);
      const now = new Date();
      const end = new Date(now);
      if (activeTimeframe === "Today") {
        end.setHours(23, 59, 59, 999);
      } else if (activeTimeframe === "Tomorrow") {
        now.setDate(now.getDate() + 1);
        now.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 1);
        end.setHours(23, 59, 59, 999);
      } else {
        end.setDate(end.getDate() + 7);
      }
      const dueCount = tasks.filter((task) => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        return due >= now && due <= end;
      }).length;
      const noteCount = briefingJson.success ? briefingJson.summary.recentNotesCount : 0;
      setSnapshotCounts({
        dueCount,
        upcomingLabel: briefingJson.success && briefingJson.data.dueToday.length > 0
          ? `${briefingJson.data.dueToday[0].title} is coming up`
          : "No upcoming meetings",
        noteCount,
      });
    } catch {
      setSnapshotCounts({ dueCount: 0, upcomingLabel: "Data unavailable right now", noteCount: 0 });
    }
  }, []);

  const speakReply = useCallback(async (text: string) => {
    if (!speakEnabled || typeof window === "undefined") {
      return;
    }

    try {
      const response = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed (${response.status})`);
      }

      const wavBlob = await response.blob();
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
        playbackAudioRef.current = null;
      }
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      audio.volume = NEXUS_VOICE_VOLUME;
      playbackAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (playbackAudioRef.current === audio) {
          playbackAudioRef.current = null;
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        if (playbackAudioRef.current === audio) {
          playbackAudioRef.current = null;
        }
      };
      await audio.play();
      return;
    } catch {
      if (!("speechSynthesis" in window)) {
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [speakEnabled]);

  useEffect(() => {
    if (!assistantReply || assistantReply === lastSpokenReplyRef.current) {
      return;
    }
    lastSpokenReplyRef.current = assistantReply;
    setTransientStatus("Assistant replied");
    void speakReply(assistantReply);
  }, [assistantReply, speakReply]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSnapshotData(timeframe);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSnapshotData, timeframe]);

  useEffect(() => {
    const onTasks = () => void fetchSnapshotData(timeframe);
    const onNotes = () => void fetchSnapshotData(timeframe);
    const onVoiceCommand = (event: Event) => {
      const custom = event as CustomEvent<{ command?: string }>;
      const command = custom.detail?.command?.toLowerCase() ?? "";
      if (command.includes("tomorrow")) setTimeframe("Tomorrow");
      if (command.includes("this week")) setTimeframe("This Week");
      if (command.includes("today")) setTimeframe("Today");
    };
    window.addEventListener("tasks-updated", onTasks);
    window.addEventListener("notes-updated", onNotes);
    window.addEventListener("voice-command", onVoiceCommand as EventListener);
    return () => {
      window.removeEventListener("tasks-updated", onTasks);
      window.removeEventListener("notes-updated", onNotes);
      window.removeEventListener("voice-command", onVoiceCommand as EventListener);
    };
  }, [fetchSnapshotData, routeToNav, timeframe]);

  useEffect(() => {
    if (!showWorkspacePanel || !workspacePanelRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      workspacePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 90);
    return () => window.clearTimeout(timer);
  }, [activeNav, showWorkspacePanel]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionImpl = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setState("idle");
      setTranscript("");
      setSpeechError("");
      commandRef.current = "";
      lastRawTranscriptRef.current = "";
      wakeDetectedRef.current = false;
      setIsVoiceActive(false);
      setVoiceEnergy(0.2);
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }
    };

    const finalizeCommand = () => {
      const commandToSend = commandRef.current.trim();
      if (!commandToSend || isFinalizingCommandRef.current) {
        return;
      }
      isFinalizingCommandRef.current = true;
      pauseRecognitionRef.current = true;
      recognition.stop();
      setIsVoiceActive(false);
      setState("responding");
      setTransientStatus(`Sending command: "${commandToSend}"`);
      lastSpokenReplyRef.current = "";
      void sendMessage({ text: commandToSend });
      window.dispatchEvent(
        new CustomEvent("voice-command", {
          detail: {
            wakeWord: "Nexus",
            command: commandToSend,
          },
        }),
      );
      commandRef.current = "";
      setTranscript("");
      window.setTimeout(() => {
        isFinalizingCommandRef.current = false;
      }, 600);
    };

    recognition.onresult = (event) => {
      if (pauseRecognitionRef.current) {
        return;
      }
      let rawTranscript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        rawTranscript += event.results[i][0].transcript;
      }
      const wakeDetected = rawTranscript.toLowerCase().includes("nexus");
      if (!wakeDetected && !wakeDetectedRef.current) {
        setState("idle");
        setIsVoiceActive(false);
        setVoiceEnergy(0.2);
        return;
      }
      wakeDetectedRef.current = true;
      const delta = Math.max(0, rawTranscript.length - lastRawTranscriptRef.current.length);
      const normalized = Math.min(1, delta / 6 + 0.35);
      setVoiceEnergy((prev) => prev * 0.15 + normalized * 0.85);
      lastRawTranscriptRef.current = rawTranscript;
      setIsVoiceActive(true);
      if (voiceActivityTimeoutRef.current) {
        window.clearTimeout(voiceActivityTimeoutRef.current);
      }
      voiceActivityTimeoutRef.current = window.setTimeout(() => {
        setIsVoiceActive(false);
      }, 180);
      const commandOnly = extractCommandAfterWakeWord(rawTranscript);
      commandRef.current = commandOnly;
      setTranscript(commandOnly);
      setState("listening");
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }
      if (commandOnly) {
        silenceTimeoutRef.current = window.setTimeout(() => {
          finalizeCommand();
        }, 1400);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setIsVoiceActive(false);
      setVoiceEnergy(0.25);
      setState("idle");
      setSpeechError("Microphone error. Check browser mic permissions and retry.");
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsVoiceActive(false);
      setVoiceEnergy(0.25);
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }
      setState((previous) => (previous === "responding" ? previous : "idle"));
      if (responseTimeoutRef.current) {
        window.clearTimeout(responseTimeoutRef.current);
      }
      responseTimeoutRef.current = window.setTimeout(() => {
        setState("idle");
      }, 2600);
      if (shouldKeepListeningRef.current) {
        window.setTimeout(() => {
          pauseRecognitionRef.current = false;
          try {
            recognition.start();
          } catch {
            // no-op
          }
        }, 120);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // no-op
    }

    return () => {
      shouldKeepListeningRef.current = false;
      recognition.stop();
      if (responseTimeoutRef.current) {
        window.clearTimeout(responseTimeoutRef.current);
      }
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }
      if (voiceActivityTimeoutRef.current) {
        window.clearTimeout(voiceActivityTimeoutRef.current);
      }
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
      }
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
        playbackAudioRef.current = null;
      }
    };
  }, [sendMessage]);

  const handlePanelAction = (panelId: string) => {
    switch (panelId) {
      case "daily":
        routeToNav("Home");
        setShowWorkspacePanel(true);
        break;
      case "notes":
        routeToNav("Notes");
        break;
      case "tasks":
        routeToNav("Tasks");
        break;
      case "calendar":
        routeToNav("Calendar");
        break;
      case "messages":
        routeToNav("Messages");
        break;
      case "weather":
        routeToNav("Insights");
        break;
      default:
        setTransientStatus("Action completed");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030711] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(58,91,255,0.2),transparent_52%),radial-gradient(circle_at_20%_20%,rgba(178,210,255,0.1),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(172,128,255,0.15),transparent_38%)]" />
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-60"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity }}
        style={{
          backgroundImage:
            "linear-gradient(110deg, rgba(17,24,39,0.2) 0%, rgba(51,71,153,0.3) 35%, rgba(18,29,62,0.18) 50%, rgba(89,65,160,0.25) 75%, rgba(17,24,39,0.25) 100%)",
          backgroundSize: "200% 200%",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[1600px] gap-4 p-4 sm:p-6">
        <SidebarNav
          activeItem={activeNav}
          onSelect={(item) => {
            routeToNav(item);
          }}
          onOpenSettings={() => routeToNav("Settings")}
        />

        <section className="relative flex min-h-[calc(100vh-3rem)] flex-1 flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.03] px-4 py-10 backdrop-blur-md sm:px-8">
          <div className="absolute right-6 top-6 hidden xl:block">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTimeframeMenu((prev) => !prev)}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-blue-50/90 backdrop-blur-xl"
              >
                {timeframe} <ChevronDown size={15} className="text-blue-100/70" />
              </button>
              {showTimeframeMenu ? (
                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/15 bg-[#101a38]/95 p-1 shadow-xl backdrop-blur-xl">
                  {(["Today", "Tomorrow", "This Week"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setTimeframe(option);
                        setShowTimeframeMenu(false);
                        setTransientStatus(`Timeframe set to ${option}`);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-blue-50/90 transition hover:bg-white/10"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-8 w-full max-w-2xl text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-blue-100/60">Nexus OS</p>
          </div>

          <AssistantOrb state={state} />
          <div className="mt-8 w-full">
            <VoiceDock
              state={state}
              isListening={isListening}
              isVoiceActive={isVoiceActive}
              voiceEnergy={voiceEnergy}
              isSupported={isSupported}
              transcript={transcript}
              displayText={headlineText}
              isResponding={isChatLoading}
            />
          </div>
          {assistantReply ? (
            <div className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-blue-200/20 bg-white/5 px-5 py-4 text-center text-blue-50/90 backdrop-blur-xl">
              {assistantReply}
            </div>
          ) : null}
          {isChatLoading ? (
            <div className="mt-4 text-sm text-blue-100/70">Nexus is thinking...</div>
          ) : null}
          {speechError ? (
            <div className="mx-auto mt-4 w-full max-w-3xl rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">
              {speechError}
            </div>
          ) : null}

          {showWorkspacePanel ? (
            <div
              ref={workspacePanelRef}
              className="mx-auto mt-5 w-full max-w-5xl rounded-3xl border border-white/15 bg-[#101830]/70 p-4 backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between text-sm text-blue-100/80">
                <span>{activeNav} Workspace</span>
                <button type="button" onClick={() => setShowWorkspacePanel(false)} className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10">
                  Close
                </button>
              </div>
              {activeNav === "Tasks" && <TasksList />}
              {activeNav === "Notes" && <NotesList />}
              {activeNav === "Home" && (
                <DailyBriefing
                  data={briefingData?.success ? briefingData : null}
                  loading={false}
                  onClose={() => setShowWorkspacePanel(false)}
                />
              )}
              {activeNav === "Calendar" && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100/80">
                  <p className="font-medium text-blue-50">Upcoming Calendar and Due Dates ({timeframe})</p>
                  {tasksCache.filter((task) => !!task.dueDate).slice(0, 6).map((task) => (
                    <div key={task.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                      <p className="text-blue-50">{task.title}</p>
                      <p className="text-xs text-blue-100/70">{task.dueDate ? new Date(task.dueDate).toLocaleString() : "No date"}</p>
                    </div>
                  ))}
                  {tasksCache.filter((task) => !!task.dueDate).length === 0 && <p>No scheduled items yet.</p>}
                </div>
              )}
              {activeNav === "Messages" && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100/80">
                  <p className="font-medium text-blue-50">Conversation Stream</p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {messages.slice(-8).map((message) => (
                      <div key={message.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.14em] text-blue-100/60">{message.role}</p>
                        <p className="text-sm text-blue-50/90">
                          {message.parts
                            .filter((part) => part.type === "text")
                            .map((part) => part.text)
                            .join(" ")
                            .trim() || "..."}
                        </p>
                      </div>
                    ))}
                    {messages.length === 0 && <p>No messages yet. Use voice or type to begin.</p>}
                  </div>
                </div>
              )}
              {activeNav === "Insights" && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100/80">
                  <p className="font-medium text-blue-50">Insights Dashboard</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs text-blue-100/70">Pending Tasks</p>
                      <p className="text-2xl text-blue-50">{tasksCache.filter((t) => t.status !== "completed" && !t.deletedAt).length}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs text-blue-100/70">Notes Stored</p>
                      <p className="text-2xl text-blue-50">{notesCache.length}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs text-blue-100/70">Voice Commands</p>
                      <p className="text-2xl text-blue-50">{messages.filter((m) => m.role === "user").length}</p>
                    </div>
                  </div>
                  <p>Try: &quot;Nexus summarize my week&quot;.</p>
                </div>
              )}
              {activeNav === "Settings" && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100/80">
                  <p className="font-medium text-blue-50">Assistant Settings</p>
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 p-3">
                    <span>Read responses aloud</span>
                    <button
                      type="button"
                      onClick={() => setSpeakEnabled((prev) => !prev)}
                      className={`rounded-lg px-3 py-1 text-xs ${speakEnabled ? "bg-emerald-500/30 text-emerald-100" : "bg-zinc-500/30 text-zinc-100"}`}
                    >
                      {speakEnabled ? "On" : "Off"}
                    </button>
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 p-3">
                    <span>Wake word mode</span>
                    <span className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-100">Nexus</span>
                  </label>
                  <p className="text-xs text-blue-100/60">More preferences can be connected here as needed.</p>
                </div>
              )}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              className="pointer-events-none absolute inset-0 hidden xl:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pointer-events-auto absolute left-6 top-8 w-72 space-y-4">
                {activePanels.slice(0, 1).map((panel) => (
                  <HudPanel key={panel.id} panel={panel} onAction={handlePanelAction} />
                ))}
              </div>
              <div className="pointer-events-auto absolute right-6 top-1/3 w-80 space-y-4">
                {activePanels.slice(1).map((panel) => (
                  <HudPanel key={panel.id} panel={panel} onAction={handlePanelAction} />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 xl:hidden">
            {activePanels.map((panel) => (
              <HudPanel key={panel.id} panel={panel} onAction={handlePanelAction} />
            ))}
          </div>

          <div className="mt-8 text-center text-xs text-blue-100/65">System: {statusMessage}</div>
          <div className="mt-2 text-center text-xs text-blue-100/45">
            AI can make mistakes. Always double-check important info.
          </div>
        </section>
      </div>
    </main>
  );
}
