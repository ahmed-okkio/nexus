"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SmartReminders } from "@/components/smart-reminders";
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

type SpeechRecognitionConstructor = new () => SpeechRecognitionType;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
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
  priority?: string;
  dueDate?: string;
  deletedAt?: string | null;
};

type NoteLite = {
  id: string;
  content: string;
  createdAt: string;
};

type SmartRemindersResponse = {
  success: boolean;
  hasReminders: boolean;
  reminders: Array<{
    type: "overdue" | "urgent" | "accumulation";
    priority: "critical" | "high" | "medium";
    message: string;
    tasks?: Array<{ id: string; title: string; dueDate?: string }>;
    count?: number;
  }>;
  totalPending: number;
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
const normalizeTtsText = (input: string) =>
  input
    .replace(/\bI've\b/gi, "I have")
    .replace(/\bI'd\b/gi, "I would")
    .replace(/\bI'll\b/gi, "I will")
    .replace(/\bwe've\b/gi, "we have")
    .replace(/\bthey've\b/gi, "they have")
    .replace(/^(\s*\b[\w']+\b)(?:\s*,\s*\1\b){1,}/i, "$1")
    .replace(/\b([\w']+)\b(?:\s*,\s*\1\b){1,}/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();

const shouldSpeakEarly = (text: string, loading: boolean) => {
  if (!text) return false;
  if (!loading) return true;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const endsLikeSentence = /[.!?]["']?$/.test(text.trim());
  return wordCount >= 7 && endsLikeSentence;
};

const splitForFastTts = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return [] as string[];
  const firstBreak = trimmed.search(/[.!?](\s|$)/);
  if (firstBreak === -1 || trimmed.length < 120) {
    return [trimmed];
  }
  const first = trimmed.slice(0, firstBreak + 1).trim();
  const rest = trimmed.slice(firstBreak + 1).trim();
  return rest ? [first, rest] : [first];
};

const formatDateKey = (input: Date | string) => {
  const date = typeof input === "string" ? new Date(input) : input;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatInputDate = (date: Date) => formatDateKey(date);

const getMonthDays = (date: Date) => {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export default function Home() {
  const [state, setState] = useState<AiState>("idle");
  const [activeNav, setActiveNav] = useState<SidebarItem>("Home");
  const [timeframe, setTimeframe] = useState<Timeframe>("Today");
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [briefingData, setBriefingData] = useState<BriefingResponse | null>(null);
  const [snapshotCounts, setSnapshotCounts] = useState({ dueCount: 0, upcomingLabel: "No upcoming meetings", noteCount: 0 });
  const [snapshotMeta, setSnapshotMeta] = useState({
    priorityLabel: "No high-priority tasks",
    notePreview: "No recent notes",
  });
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [tasksCache, setTasksCache] = useState<TaskLite[]>([]);
  const [notesCache, setNotesCache] = useState<NoteLite[]>([]);
  const [remindersData, setRemindersData] = useState<SmartRemindersResponse | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState(() => formatInputDate(new Date()));
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderError, setReminderError] = useState("");
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
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
  const [micEnabled, setMicEnabled] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const commandRef = useRef("");
  const lastRawTranscriptRef = useRef("");
  const responseTimeoutRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const lastSpokenReplyRef = useRef("");
  const lastSpokenAssistantMessageIdRef = useRef("");
  const shouldKeepListeningRef = useRef(true);
  const isFinalizingCommandRef = useRef(false);
  const pauseRecognitionRef = useRef(false);
  const voiceActivityTimeoutRef = useRef<number | null>(null);
  const wakeDetectedRef = useRef(false);
  const shouldResumeListeningRef = useRef(false);
  const workspacePanelRef = useRef<HTMLDivElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const micEnabledRef = useRef(true);
  const orbAnchorRef = useRef<HTMLDivElement | null>(null);
  const processedToolResultMessageIdRef = useRef("");
  const [showMiniOrb, setShowMiniOrb] = useState(false);
  const [wakePulseToken, setWakePulseToken] = useState(0);
  const [wakeFlashActive, setWakeFlashActive] = useState(false);
  const wakeFlashTimeoutRef = useRef<number | null>(null);
  const [orbVoicePulse, setOrbVoicePulse] = useState(0);
  const [visibleAssistantReply, setVisibleAssistantReply] = useState("");
  const ttsPulseRafRef = useRef<number | null>(null);
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
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
          { label: `${snapshotCounts.dueCount} tasks due ${timeframe.toLowerCase()}`, sublabel: snapshotMeta.priorityLabel },
          { label: snapshotCounts.upcomingLabel, sublabel: snapshotMeta.notePreview },
        ],
      };
    });
  }, [snapshotCounts, snapshotMeta, state, timeframe]);
  const scheduledTasks = useMemo(
    () =>
      tasksCache
        .filter((task) => !task.deletedAt && task.dueDate)
        .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()),
    [tasksCache],
  );
  const calendarDays = useMemo(() => getMonthDays(calendarDate), [calendarDate]);
  const tasksByDate = useMemo(() => {
    return scheduledTasks.reduce<Record<string, TaskLite[]>>((acc, task) => {
      if (!task.dueDate) {
        return acc;
      }
      const key = formatDateKey(task.dueDate);
      acc[key] = [...(acc[key] ?? []), task];
      return acc;
    }, {});
  }, [scheduledTasks]);
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
  const assistantReplyMessageId = useMemo(() => {
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    return assistantMessages[assistantMessages.length - 1]?.id ?? "";
  }, [messages]);

  const headlineText = useMemo(() => {
    if (isChatLoading && !visibleAssistantReply) {
      return "Thinking through your request...";
    }
    return visibleAssistantReply || "How can I help today?";
  }, [visibleAssistantReply, isChatLoading]);

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

  const handleMicToggle = () => {
    const nextEnabled = !micEnabledRef.current;
    micEnabledRef.current = nextEnabled;
    setMicEnabled(nextEnabled);
    if (nextEnabled) {
      setSpeechError("");
      pauseRecognitionRef.current = false;
      try {
        recognitionRef.current?.start();
      } catch {
        // no-op
      }
      return;
    }
    recognitionRef.current?.stop();
    shouldResumeListeningRef.current = false;
    setIsListening(false);
    setIsVoiceActive(false);
    setVoiceEnergy(0.2);
    setState("idle");
    setSpeechError("");
  };

  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) {
      return;
    }
    if (status !== "ready") {
      return;
    }
    if (processedToolResultMessageIdRef.current === lastAssistant.id) {
      return;
    }
    const hasAssistantText = lastAssistant.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
    if (!hasAssistantText) {
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
    if (hasTaskResult || hasNoteResult) {
      processedToolResultMessageIdRef.current = lastAssistant.id;
    }
  }, [messages, routeToNav, status]);

  const fetchSnapshotData = useCallback(async (activeTimeframe: Timeframe) => {
    try {
      const [briefingRes, tasksRes, notesRes, remindersRes] = await Promise.all([
        fetch("/api/tasks/briefing"),
        fetch("/api/tasks"),
        fetch("/api/notes"),
        fetch("/api/tasks/reminders"),
      ]);
      const briefingJson = (await briefingRes.json()) as BriefingResponse;
      const tasksJson = (await tasksRes.json()) as { tasks?: TaskLite[] };
      const notesJson = (await notesRes.json()) as { notes?: NoteLite[] };
      const remindersJson = (await remindersRes.json()) as SmartRemindersResponse;
      setBriefingData(briefingJson.success ? briefingJson : null);
      const tasks = (tasksJson.tasks ?? []).filter((task) => !task.deletedAt && task.status !== "completed");
      setTasksCache(tasksJson.tasks ?? []);
      const notes = notesJson.notes ?? [];
      setNotesCache(notes);
      setRemindersData(remindersJson.success ? remindersJson : null);
      const now = new Date();
      const rangeStart = new Date(now);
      const rangeEnd = new Date(now);
      if (activeTimeframe === "Today") {
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setHours(23, 59, 59, 999);
      } else if (activeTimeframe === "Tomorrow") {
        rangeStart.setDate(rangeStart.getDate() + 1);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
        rangeEnd.setHours(23, 59, 59, 999);
      } else {
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setDate(rangeEnd.getDate() + 7);
        rangeEnd.setHours(23, 59, 59, 999);
      }
      const dueCount = tasks.filter((task) => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        return due >= rangeStart && due <= rangeEnd;
      }).length;
      const noteCount = briefingJson.success ? briefingJson.summary.recentNotesCount : 0;
      const highPriority = tasks.filter((task) => task.status === "pending" && task.priority === "high");
      const latestNote = notes[0]?.content?.trim();
      setSnapshotCounts({
        dueCount,
        upcomingLabel: briefingJson.success && briefingJson.data.dueToday.length > 0
          ? `${briefingJson.data.dueToday[0].title} is coming up`
          : "No due tasks in this window",
        noteCount,
      });
      setSnapshotMeta({
        priorityLabel:
          highPriority.length > 0
            ? `${highPriority.length} high-priority ${highPriority.length === 1 ? "task" : "tasks"}`
            : "No high-priority tasks",
        notePreview: latestNote ? `Latest note: ${latestNote.slice(0, 58)}${latestNote.length > 58 ? "..." : ""}` : "No recent notes",
      });
    } catch {
      setSnapshotCounts({ dueCount: 0, upcomingLabel: "Data unavailable right now", noteCount: 0 });
      setSnapshotMeta({ priorityLabel: "Snapshot unavailable", notePreview: "Snapshot unavailable" });
      setRemindersData(null);
    }
  }, []);

  const handleCreateReminder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = reminderTitle.trim();

    if (!title) {
      setReminderError("Add a reminder title first.");
      return;
    }

    const dueDate = new Date(`${reminderDate}T${reminderTime || "09:00"}`);
    if (Number.isNaN(dueDate.getTime())) {
      setReminderError("Choose a valid reminder date and time.");
      return;
    }

    setIsCreatingReminder(true);
    setReminderError("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "Calendar reminder",
          priority: "medium",
          dueDate: dueDate.toISOString(),
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create reminder.");
      }

      setReminderTitle("");
      setCalendarDate(new Date(dueDate.getFullYear(), dueDate.getMonth(), 1));
      setStatusMessage("Reminder added to calendar");
      window.dispatchEvent(new CustomEvent("tasks-updated"));
      await fetchSnapshotData(timeframe);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Could not create reminder.");
    } finally {
      setIsCreatingReminder(false);
    }
  }, [fetchSnapshotData, reminderDate, reminderTime, reminderTitle, timeframe]);

  const speakReply = useCallback(async (text: string, onFirstAudioReady?: () => void) => {
    if (!speakEnabled || typeof window === "undefined") {
      return;
    }
    const ttsText = normalizeTtsText(text);
    if (!ttsText) {
      return;
    }
    const chunks = splitForFastTts(ttsText);
    if (chunks.length === 0) {
      return;
    }

    try {
      let didSignalReady = false;
      const playChunk = async (chunkText: string) => {
        const response = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunkText }),
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
        if (!didSignalReady) {
          await new Promise<void>((resolve) => {
            const markReady = () => {
              if (!didSignalReady) {
                didSignalReady = true;
                onFirstAudioReady?.();
              }
              resolve();
            };
            if (audio.readyState >= 3) {
              markReady();
              return;
            }
            audio.oncanplaythrough = () => markReady();
            audio.onerror = () => resolve();
          });
        }
        try {
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.68;
          const source = audioContext.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }
          ttsAudioContextRef.current?.close().catch(() => {});
          ttsAudioContextRef.current = audioContext;
          ttsAnalyserRef.current = analyser;
          if (ttsPulseRafRef.current) {
            window.cancelAnimationFrame(ttsPulseRafRef.current);
          }
          const bins = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            const currentAnalyser = ttsAnalyserRef.current;
            if (!currentAnalyser) {
              return;
            }
            currentAnalyser.getByteFrequencyData(bins);
            let sum = 0;
            for (let i = 0; i < bins.length; i += 1) {
              sum += bins[i];
            }
            const avg = sum / bins.length;
            const normalized = Math.min(1, avg / 48);
            const speakingFloor = audio.paused || audio.ended ? 0 : 0.32;
            setOrbVoicePulse((prev) => prev * 0.14 + Math.max(normalized, speakingFloor) * 0.86);
            ttsPulseRafRef.current = window.requestAnimationFrame(tick);
          };
          tick();
        } catch {
          // no-op
        }
        playbackAudioRef.current = audio;
        setOrbVoicePulse(0.3);
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          void audio.play().catch(() => reject(new Error("Audio playback failed")));
        });
        if (ttsPulseRafRef.current) {
          window.cancelAnimationFrame(ttsPulseRafRef.current);
          ttsPulseRafRef.current = null;
        }
        ttsAnalyserRef.current = null;
        ttsAudioContextRef.current?.close().catch(() => {});
        ttsAudioContextRef.current = null;
        setOrbVoicePulse(0);
        URL.revokeObjectURL(audioUrl);
        if (playbackAudioRef.current === audio) {
          playbackAudioRef.current = null;
        }
      };

      for (const chunk of chunks) {
        await playChunk(chunk);
      }
      return;
    } catch {
      if (!("speechSynthesis" in window)) {
        return;
      }
      onFirstAudioReady?.();
      const utterance = new SpeechSynthesisUtterance(ttsText);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [speakEnabled]);

  useEffect(() => {
    if (!assistantReply || !assistantReplyMessageId) {
      return;
    }
    if (!shouldSpeakEarly(assistantReply, isChatLoading)) {
      return;
    }
    if (assistantReplyMessageId === lastSpokenAssistantMessageIdRef.current) {
      return;
    }
    if (assistantReply === lastSpokenReplyRef.current) {
      return;
    }
    setVisibleAssistantReply("");
    lastSpokenAssistantMessageIdRef.current = assistantReplyMessageId;
    lastSpokenReplyRef.current = assistantReply;
    setTransientStatus("Assistant replied");
    void speakReply(assistantReply, () => {
      setVisibleAssistantReply(assistantReply);
    });
  }, [assistantReply, assistantReplyMessageId, isChatLoading, speakReply, status]);

  useEffect(() => {
    if (status !== "ready" || !shouldResumeListeningRef.current || !micEnabledRef.current) {
      return;
    }
    shouldResumeListeningRef.current = false;
    window.setTimeout(() => {
      pauseRecognitionRef.current = false;
      try {
        recognitionRef.current?.start();
      } catch {
        // no-op
      }
    }, 120);
  }, [status]);

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
    const observerTarget = orbAnchorRef.current;
    if (!observerTarget) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowMiniOrb(!entry.isIntersecting);
      },
      {
        threshold: 0.22,
      },
    );
    observer.observe(observerTarget);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionImpl = (speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined;
    if (!SpeechRecognitionImpl) {
      return;
    }

    const recognition: SpeechRecognitionType = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setState("idle");
      setTranscript("");
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
      shouldResumeListeningRef.current = true;
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
      if (wakeDetected && !wakeDetectedRef.current) {
        setWakePulseToken((prev) => prev + 1);
        setWakeFlashActive(true);
        if (wakeFlashTimeoutRef.current) {
          window.clearTimeout(wakeFlashTimeoutRef.current);
        }
        wakeFlashTimeoutRef.current = window.setTimeout(() => {
          setWakeFlashActive(false);
        }, 900);
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

    recognition.onerror = (event) => {
      setIsListening(false);
      setIsVoiceActive(false);
      setVoiceEnergy(0.25);
      setState("idle");

      if (event.error === "no-speech") {
        setSpeechError("");
        return;
      }

      setSpeechError(`Microphone error: ${event.error}. Check browser mic permissions and retry.`);
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

      // Keep the wake-word listener alive unless we intentionally paused it
      // while sending a command and waiting for assistant completion.
      if (micEnabledRef.current && !pauseRecognitionRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // no-op
          }
        }, 140);
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
      if (wakeFlashTimeoutRef.current) {
        window.clearTimeout(wakeFlashTimeoutRef.current);
      }
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
        playbackAudioRef.current = null;
      }
      if (ttsPulseRafRef.current) {
        window.cancelAnimationFrame(ttsPulseRafRef.current);
        ttsPulseRafRef.current = null;
      }
      ttsAnalyserRef.current = null;
      ttsAudioContextRef.current?.close().catch(() => {});
      ttsAudioContextRef.current = null;
      setOrbVoicePulse(0);
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

          <div ref={orbAnchorRef} className="relative flex h-[260px] w-[260px] items-center justify-center sm:h-[360px] sm:w-[360px]">
            <AnimatePresence initial={false} mode="wait">
              {!showMiniOrb ? (
                <motion.div
                  key="main-orb"
                  initial={{ opacity: 0.92, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.82, y: -14 }}
                  transition={{ duration: 0.26, ease: "easeOut" }}
                >
                  <AssistantOrb state={state} voicePulse={orbVoicePulse} />
                </motion.div>
              ) : (
                <div className="h-[260px] w-[260px] sm:h-[360px] sm:w-[360px]" />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {!showMiniOrb && wakeFlashActive ? (
                <motion.div
                  key={wakePulseToken}
                  className="pointer-events-none absolute inset-0 rounded-full border border-violet-200/50"
                  initial={{ scale: 0.78, opacity: 0.95 }}
                  animate={{ scale: 1.32, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.78, ease: "easeOut" }}
                />
              ) : null}
            </AnimatePresence>
          </div>
          <div className="mt-8 w-full">
            <VoiceDock
              state={state}
              isListening={isListening}
              isVoiceActive={isVoiceActive}
              voiceEnergy={voiceEnergy}
              micEnabled={micEnabled}
              isSupported={isSupported}
              transcript={transcript}
              displayText={headlineText}
              isResponding={isChatLoading}
              onMicToggle={handleMicToggle}
              wakeFlashActive={wakeFlashActive}
            />
          </div>
          {visibleAssistantReply ? (
            <div className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-blue-200/20 bg-white/5 px-5 py-4 text-center text-blue-50/90 backdrop-blur-xl">
              {visibleAssistantReply}
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
              {activeNav === "Tasks" ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-sm font-medium text-blue-50">Smart Reminders</p>
                  <SmartReminders data={remindersData} loading={false} />
                </div>
              ) : null}
              {activeNav === "Notes" && <NotesList />}
              {activeNav === "Home" && (
                <div className="space-y-4">
                  <DailyBriefing
                    data={briefingData?.success ? briefingData : null}
                    loading={false}
                    onClose={() => setShowWorkspacePanel(false)}
                  />
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-3 text-sm font-medium text-blue-50">Smart Reminders</p>
                    <SmartReminders data={remindersData} loading={false} />
                  </div>
                </div>
              )}
              {activeNav === "Calendar" && (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100/80">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-medium text-blue-50">Calendar and Reminders</p>
                      <p className="text-xs text-blue-100/60">Scheduled tasks show up here automatically.</p>
                    </div>
                    <form onSubmit={handleCreateReminder} className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_140px_105px_auto]">
                      <input
                        value={reminderTitle}
                        onChange={(event) => setReminderTitle(event.target.value)}
                        placeholder="Reminder"
                        className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-blue-50 outline-none placeholder:text-blue-100/35 focus:border-blue-300/50"
                      />
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(event) => setReminderDate(event.target.value)}
                        className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-blue-50 outline-none focus:border-blue-300/50"
                      />
                      <input
                        type="time"
                        value={reminderTime}
                        onChange={(event) => setReminderTime(event.target.value)}
                        className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-blue-50 outline-none focus:border-blue-300/50"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingReminder}
                        className="h-10 rounded-xl border border-blue-200/20 bg-blue-300/15 px-4 text-sm font-medium text-blue-50 transition hover:bg-blue-300/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCreatingReminder ? "Adding" : "Add"}
                      </button>
                    </form>
                  </div>
                  {reminderError ? <p className="text-xs text-red-200">{reminderError}</p> : null}
                  <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                          className="rounded-lg border border-white/10 px-3 py-1 text-xs text-blue-100 hover:bg-white/10"
                        >
                          Prev
                        </button>
                        <p className="text-sm font-medium text-blue-50">
                          {calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                          className="rounded-lg border border-white/10 px-3 py-1 text-xs text-blue-100 hover:bg-white/10"
                        >
                          Next
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-blue-100/45">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                          <div key={day} className="py-1">{day}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day) => {
                          const key = formatDateKey(day);
                          const dayTasks = tasksByDate[key] ?? [];
                          const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                          const isToday = key === formatDateKey(new Date());

                          return (
                            <div
                              key={key}
                              className={`min-h-[82px] rounded-xl border p-2 text-left ${
                                isToday
                                  ? "border-blue-200/45 bg-blue-300/10"
                                  : "border-white/10 bg-white/[0.03]"
                              } ${isCurrentMonth ? "text-blue-50" : "text-blue-100/35"}`}
                            >
                              <div className="mb-1 text-xs">{day.getDate()}</div>
                              <div className="space-y-1">
                                {dayTasks.slice(0, 2).map((task) => (
                                  <div key={task.id} className="truncate rounded-md bg-blue-200/15 px-2 py-1 text-[11px] text-blue-50">
                                    {task.title}
                                  </div>
                                ))}
                                {dayTasks.length > 2 ? (
                                  <div className="text-[11px] text-blue-100/55">+{dayTasks.length - 2} more</div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/15 p-3">
                      <p className="text-xs font-medium uppercase text-blue-100/55">Upcoming</p>
                      {scheduledTasks.slice(0, 8).map((task) => (
                        <div key={task.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                          <p className="truncate text-blue-50">{task.title}</p>
                          <p className="text-xs text-blue-100/65">{task.dueDate ? new Date(task.dueDate).toLocaleString() : "No date"}</p>
                        </div>
                      ))}
                      {scheduledTasks.length === 0 ? <p>No scheduled reminders yet.</p> : null}
                    </div>
                  </div>
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
                  <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="mb-2 text-xs text-blue-100/70">Smart Reminders</p>
                    <SmartReminders data={remindersData} loading={false} />
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

      <AnimatePresence>
        {showMiniOrb ? (
          <motion.div
            initial={{ opacity: 0, x: 38, scale: 0.72 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 38, scale: 0.72 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="fixed right-6 top-1/2 z-40 hidden w-[170px] -translate-y-1/2 xl:block"
          >
            <button
              type="button"
              onClick={() => {
                orbAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="mx-auto block rounded-full border border-blue-100/30 bg-[#0a132d]/70 p-1 shadow-[0_0_35px_rgba(99,136,255,0.35)] backdrop-blur-xl"
              aria-label="Focus assistant orb"
            >
              <AssistantOrb state={state} compact voicePulse={orbVoicePulse} />
            </button>
            <div className="mt-2 rounded-xl border border-blue-100/20 bg-[#0a132d]/75 px-3 py-2 text-center text-xs text-blue-50/90 backdrop-blur-xl">
              {assistantReply || "Nexus is listening..."}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
