'use client';

import { Bell, AlertCircle, Clock, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReminderTask {
  id: string;
  title: string;
  dueDate?: string;
}

interface Reminder {
  type: 'overdue' | 'urgent' | 'accumulation';
  priority: 'critical' | 'high' | 'medium';
  message: string;
  tasks?: ReminderTask[];
  count?: number;
}

interface SmartRemindersData {
  hasReminders: boolean;
  reminders: Reminder[];
  totalPending: number;
}

interface SmartRemindersProps {
  data: SmartRemindersData | null;
  loading: boolean;
}

export function SmartReminders({ data, loading }: SmartRemindersProps) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
        <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
      </div>
    );
  }

  if (!data || !data.hasReminders) {
    return (
      <div className="p-4 text-center border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/50">
        <p className="text-xs text-zinc-500">No urgent reminders. Keep it up!</p>
      </div>
    );
  }

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-50 border-red-100 text-red-700 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400';
      case 'high': return 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400';
      default: return 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-400';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'overdue': return <AlertCircle size={16} />;
      case 'urgent': return <Clock size={16} />;
      default: return <ListChecks size={16} />;
    }
  };

  return (
    <div className="space-y-3">
      {data.reminders.map((reminder, idx) => (
        <div 
          key={idx}
          className={cn(
            "p-3 rounded-xl border text-sm flex gap-3",
            getPriorityStyles(reminder.priority)
          )}
        >
          <div className="mt-0.5">{getIcon(reminder.type)}</div>
          <div className="space-y-1 flex-1">
            <p className="font-semibold leading-none">{reminder.message}</p>
            {reminder.tasks && reminder.tasks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {reminder.tasks.map(task => (
                  <li key={task.id} className="text-xs opacity-80 flex items-center gap-1">
                    <span className="w-1 h-1 bg-current rounded-full" />
                    {task.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
