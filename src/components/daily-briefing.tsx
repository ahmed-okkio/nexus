'use client';

import { Calendar, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface DailyBriefingData {
  summary: {
    overdueCount: number;
    dueTodayCount: number;
    recentNotesCount: number;
  };
  data: {
    overdue: Task[];
    dueToday: Task[];
    recentNotes: Note[];
  };
}

interface DailyBriefingProps {
  data: DailyBriefingData | null;
  loading: boolean;
  onClose: () => void;
}

export function DailyBriefing({ data, loading, onClose }: DailyBriefingProps) {
  if (loading) {
    return (
      <div className="p-8 text-center animate-pulse">
        <div className="h-4 bg-zinc-200 rounded w-3/4 mx-auto mb-4"></div>
        <div className="h-4 bg-zinc-200 rounded w-1/2 mx-auto"></div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, data: details } = data;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Calendar className="text-blue-500" size={24} />
          Your Daily Briefing
        </h3>
        <button 
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
        >
          Dismiss
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <AlertCircle size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{summary.overdueCount}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Due Today</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.dueTodayCount}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
            <FileText size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">New Notes</span>
          </div>
          <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{summary.recentNotesCount}</p>
        </div>
      </div>

      <div className="space-y-4">
        {details.overdue.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 px-1">Attention Required</h4>
            <div className="space-y-2">
              {details.overdue.map(task => (
                <div key={task.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm shadow-sm">
                  {task.title}
                </div>
              ))}
            </div>
          </section>
        )}

        {details.dueToday.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 px-1">Today&apos;s Focus</h4>
            <div className="space-y-2">
              {details.dueToday.map(task => (
                <div key={task.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm shadow-sm">
                  {task.title}
                </div>
              ))}
            </div>
          </section>
        )}

        {details.recentNotes.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 px-1">Recent Insights</h4>
            <div className="space-y-2">
              {details.recentNotes.map(note => (
                <div key={note.id} className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm italic text-zinc-700 dark:text-zinc-300">
                  &quot;{note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content}&quot;
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
