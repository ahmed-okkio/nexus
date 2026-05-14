'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  dueDate?: string;
  deletedAt?: string;
}

export function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutsRef = useRef<number[]>([]);
  const tasksRef = useRef<Task[]>([]);

  const clearPendingAnimations = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const reconcileTasks = useCallback((nextTasks: Task[]) => {
    clearPendingAnimations();
    const currentTasks = tasksRef.current;
    const currentIds = new Set(currentTasks.map((task) => task.id));
    const nextIds = new Set(nextTasks.map((task) => task.id));
    const removedIds = currentTasks.map((task) => task.id).filter((id) => !nextIds.has(id));
    const hasNewItems = nextTasks.some((task) => !currentIds.has(task.id));

    if (removedIds.length === 0 || hasNewItems) {
      setTasks(nextTasks);
      return;
    }

    removedIds.forEach((removedId, index) => {
      const timeoutId = window.setTimeout(() => {
        setTasks((previous) => previous.filter((task) => task.id !== removedId));
      }, index * 130);
      timeoutsRef.current.push(timeoutId);
    });

    const finalizeId = window.setTimeout(() => {
      setTasks(nextTasks);
    }, removedIds.length * 130 + 20);
    timeoutsRef.current.push(finalizeId);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to fetch tasks');
      }
      const data = await response.json();
      // Only show non-deleted tasks
      const nextTasks = data.tasks?.filter((t: Task) => !t.deletedAt) || [];
      reconcileTasks(nextTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // We'll keep the empty state but maybe show the error in console for now
      setTasks([]);
      // Setting a temporary error state might be good too if we had one
    } finally {
      setLoading(false);
    }
  }, [reconcileTasks]);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void fetchTasks();
    }, 0);

    const handleUpdate = () => {
      void fetchTasks();
    };

    window.addEventListener('tasks-updated', handleUpdate);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener('tasks-updated', handleUpdate);
      clearPendingAnimations();
    };
  }, [fetchTasks]);

  const handleToggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      const updatedTask = await response.json();
      setTasks(tasks.map(t => (t.id === id ? updatedTask.task : t)));
      window.dispatchEvent(new CustomEvent("tasks-updated"));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Failed to delete task');
      setTasks(tasks.filter(t => t.id !== id));
      window.dispatchEvent(new CustomEvent("tasks-updated"));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-100';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'low': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      default: return 'text-zinc-600 bg-zinc-50 border-zinc-100';
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-zinc-300/80 p-4 text-center text-zinc-500 animate-pulse dark:border-zinc-600">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-zinc-300/80 p-8 text-center dark:border-zinc-700">
        <Clock className="mx-auto mb-2 text-zinc-400 dark:text-zinc-500" size={32} />
        <p className="text-sm text-zinc-500 dark:text-zinc-300">No active tasks. Create one via chat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {tasks.map(task => (
        <motion.div
          key={task.id}
          layout
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: -10, filter: "blur(2px)" }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={cn(
            "group flex items-start gap-4 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg",
            task.status === 'completed'
              ? 'border-zinc-200 bg-zinc-100/50 opacity-80 dark:border-zinc-700 dark:bg-zinc-800/40'
              : 'border-zinc-200/80 bg-white dark:border-zinc-700 dark:bg-zinc-900/80'
          )}
        >
          <button
            onClick={() => handleToggleTask(task.id, task.status)}
            className={cn(
              "flex-shrink-0 mt-0.5 transition-colors",
              task.status === 'completed' ? 'text-emerald-500' : 'text-zinc-300 hover:text-blue-500'
            )}
          >
            {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={cn(
                "font-medium break-words",
                task.status === 'completed' ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
              )}>
                {task.title}
              </p>
              <span className={cn(
                "flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                getPriorityColor(task.priority)
              )}>
                {task.priority}
              </span>
            </div>

            {task.description && (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-300">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3">
              {task.dueDate && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock size={12} />
                  <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
              )}
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Delete task"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  );
}
