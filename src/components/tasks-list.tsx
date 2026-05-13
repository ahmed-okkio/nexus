'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Trash2, AlertTriangle, Info, Clock } from 'lucide-react';
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

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to fetch tasks');
      }
      const data = await response.json();
      // Only show non-deleted tasks
      setTasks(data.tasks?.filter((t: Task) => !t.deletedAt) || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // We'll keep the empty state but maybe show the error in console for now
      setTasks([]);
      // Setting a temporary error state might be good too if we had one
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const handleUpdate = () => {
      fetchTasks();
    };

    window.addEventListener('tasks-updated', handleUpdate);
    return () => window.removeEventListener('tasks-updated', handleUpdate);
  }, []);

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
    return <div className="p-4 text-center text-zinc-500 animate-pulse">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
        <Clock className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={32} />
        <p className="text-sm text-zinc-500">No active tasks. Create one via chat!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <div
          key={task.id}
          className={cn(
            "group p-4 border rounded-xl flex items-start gap-4 transition-all hover:shadow-sm",
            task.status === 'completed'
              ? 'bg-zinc-50/50 border-zinc-200 opacity-75'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
          )}
        >
          <button
            onClick={() => handleToggleTask(task.id, task.status)}
            className={cn(
              "flex-shrink-0 mt-0.5 transition-colors",
              task.status === 'completed' ? 'text-emerald-500' : 'text-zinc-300 hover:text-emerald-500'
            )}
          >
            {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={cn(
                "font-medium break-words",
                task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'
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
              <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
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
        </div>
      ))}
    </div>
  );
}
