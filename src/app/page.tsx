'use client';

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { TasksList } from "@/components/tasks-list";
import { NotesList } from "@/components/notes-list";
import { DailyBriefing } from "@/components/daily-briefing";
import { Bot, CheckSquare } from "lucide-react";

const ChatInterface = dynamic(
  () => import("@/components/chat-interface").then((module) => module.ChatInterface),
  { ssr: false }
);

interface DailyBriefingResponse {
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
}

export default function Home() {
  const [briefingData, setBriefingData] = useState<DailyBriefingResponse | null>(null);
  const [showBriefing, setShowBriefing] = useState(true);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  
  const showBriefingRef = useRef(false);
  useEffect(() => {
    showBriefingRef.current = showBriefing;
  }, [showBriefing]);

  const fetchBriefingData = async (quiet = false) => {
    if (!quiet) setLoadingBriefing(true);
    try {
      const response = await fetch('/api/tasks/briefing');
      const data = await response.json();
      if (data.success) {
        setBriefingData(data);
      }
    } catch (error) {
      console.error("Failed to fetch briefing:", error);
    } finally {
      if (!quiet) setLoadingBriefing(false);
    }
  };

  const fetchRemindersData = async () => {
    try {
      const response = await fetch('/api/tasks/reminders');
      await response.json();
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    }
  };

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void fetchBriefingData();
      void fetchRemindersData();
    }, 0);

    const handleUpdate = () => {
      if (showBriefingRef.current) {
        void fetchBriefingData(true);
      }
      void fetchRemindersData();
    };
    const handleShowBriefing = () => {
      setShowBriefing(true);
      void fetchBriefingData();
    };

    window.addEventListener('show-briefing', handleShowBriefing);
    window.addEventListener('tasks-updated', handleUpdate);
    window.addEventListener('notes-updated', handleUpdate);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener('show-briefing', handleShowBriefing);
      window.removeEventListener('tasks-updated', handleUpdate);
      window.removeEventListener('notes-updated', handleUpdate);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/30 bg-transparent backdrop-blur-md dark:border-zinc-700/40">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Nexus Workspace</p>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 lg:text-3xl">Your AI Command Center</h1>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200">
            Live Assistant
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1320px] flex-1 px-5 py-6 lg:px-8 lg:py-8">
        <div className="w-full space-y-7">
          <section className="mx-auto w-full max-w-5xl space-y-4">
            <div className="flex items-center justify-center gap-2 px-1 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-300">
              <Bot size={16} />
              Central Conversation
            </div>
            <div className="h-[78vh] min-h-[700px] overflow-hidden rounded-3xl border border-white/70 bg-white/88 shadow-[0_30px_80px_-36px_rgba(22,34,77,0.58)] ring-1 ring-zinc-200/50 backdrop-blur-sm dark:border-zinc-700/70 dark:bg-zinc-900/78 dark:ring-zinc-700/70">
                <ChatInterface />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {showBriefing && (
              <div className="rounded-3xl border border-blue-200/50 bg-linear-to-br from-blue-50 to-white p-5 shadow-[0_15px_35px_-25px_rgba(45,99,255,0.6)] dark:border-blue-500/20 dark:from-blue-500/10 dark:to-zinc-900">
                <DailyBriefing 
                  data={briefingData} 
                  loading={loadingBriefing} 
                  onClose={() => setShowBriefing(false)} 
                />
              </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/85 shadow-[0_14px_45px_-32px_rgba(25,36,77,0.45)] backdrop-blur-sm dark:border-zinc-700/70 dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-white/45 p-4 font-semibold text-zinc-700 dark:border-zinc-700/70 dark:bg-zinc-900/30 dark:text-zinc-200">
                <CheckSquare size={18} />
                Tasks
              </div>
              <div className="p-4">
                <TasksList />
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/85 shadow-[0_14px_45px_-32px_rgba(25,36,77,0.45)] backdrop-blur-sm dark:border-zinc-700/70 dark:bg-zinc-900/70">
              <NotesList />
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-8 border-t border-white/60 bg-white/50 dark:border-zinc-700/70 dark:bg-zinc-900/45">
        <div className="mx-auto max-w-7xl px-5 py-5 text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 lg:px-8">
          <p>Nexus · Los Hackathon 2026</p>
        </div>
      </footer>
    </div>
  );
}
