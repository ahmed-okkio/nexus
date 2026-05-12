'use client';

import { useEffect, useState } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  dueDate?: string;
}

export function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // In a real app, this would be an API call
        // For now, we're fetching from database via a route
        const response = await fetch('/api/tasks');
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const data = await response.json();
        setTasks(data.tasks || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
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
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return <div className="p-4 text-center text-gray-500">No tasks yet. Create one via chat!</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold mb-4">Tasks</h2>
      {tasks.map(task => (
        <div
          key={task.id}
          className={`p-3 border rounded-lg flex items-start gap-3 ${
            task.status === 'completed'
              ? 'bg-green-50 border-green-200'
              : 'bg-white border-gray-200'
          }`}
        >
          <button
            onClick={() => handleToggleTask(task.id, task.status)}
            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors ${
              task.status === 'completed'
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 hover:border-green-500'
            }`}
          >
            {task.status === 'completed' && (
              <span className="text-white text-xs">✓</span>
            )}
          </button>
          <div className="flex-1">
            <p className={task.status === 'completed' ? 'line-through text-gray-500' : ''}>
              {task.title}
            </p>
            {task.dueDate && (
              <p className="text-xs text-gray-500 mt-1">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
