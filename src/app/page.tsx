'use client';

import { useState, useEffect, useRef } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { TasksList } from "@/components/tasks-list";
import { NotesList } from "@/components/notes-list";
import { DailyBriefing } from "@/components/daily-briefing";

export default function Home() {
  const [briefingData, setBriefingData] = useState<any>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const showBriefingRef = useRef(false);
  showBriefingRef.current = showBriefing;

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

  const handleShowBriefing = () => {
    setShowBriefing(true);
    fetchBriefingData();
  };

  useEffect(() => {
    setMounted(true);
    handleShowBriefing();

    const handleUpdate = () => {
      if (showBriefingRef.current) {
        fetchBriefingData(true);
      }
    };

    window.addEventListener('show-briefing', handleShowBriefing);
    window.addEventListener('tasks-updated', handleUpdate);
    window.addEventListener('notes-updated', handleUpdate);

    return () => {
      window.removeEventListener('show-briefing', handleShowBriefing);
      window.removeEventListener('tasks-updated', handleUpdate);
      window.removeEventListener('notes-updated', handleUpdate);
    };
  }, []);

  if (!mounted) return <div className="min-h-screen bg-zinc-50" />;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Nexus</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Your personal AI assistant</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Chat - Takes 2 cols on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden h-[600px]">
              <ChatInterface />
            </div>
          </div>

          {/* Sidebar - Tasks and Notes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Daily Briefing (Conditional) */}
            {showBriefing && (
              <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-md border-2 border-blue-100 dark:border-blue-900/30 p-6">
                <DailyBriefing 
                  data={briefingData} 
                  loading={loadingBriefing} 
                  onClose={() => setShowBriefing(false)} 
                />
              </div>
            )}

            {/* Tasks */}
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
              <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Tasks</h2>
              <TasksList />
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <NotesList />
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
              <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Quick Actions</h2>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 text-sm font-medium transition-colors">
                  View All Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-zinc-50 dark:bg-zinc-950 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>Nexus &mdash; Made for the LOS Hackathon 2026</p>
        </div>
      </footer>
    </div>
  );
}
