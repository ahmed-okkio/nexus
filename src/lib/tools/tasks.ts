import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';

export const createTask = tool({
  description: 'Create a new task with an optional due date and description',
  parameters: z.object({
    title: z.string().describe('The title of the task'),
    description: z.string().optional().describe('Optional detailed description of the task'),
    dueDate: z.string().optional().describe('Optional due date in ISO format (YYYY-MM-DD)'),
  }),
  execute: async ({ title, description, dueDate }) => {
    const task = await db.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
    });
    return {
      success: true,
      task,
    };
  },
});

export const getTasks = tool({
  description: 'Get all tasks, ordered by creation date',
  parameters: z.object({
    status: z.enum(['pending', 'completed']).optional().describe('Filter by task status'),
  }),
  execute: async ({ status }) => {
    const tasks = await db.task.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      tasks,
      count: tasks.length,
    };
  },
});

export const toggleTask = tool({
  description: 'Update task status (mark as completed or reopen)',
  parameters: z.object({
    id: z.string().describe('The task ID'),
    status: z.enum(['pending', 'completed']).describe('The new status'),
  }),
  execute: async ({ id, status }) => {
    const task = await db.task.update({
      where: { id },
      data: { status },
    });
    return {
      success: true,
      task,
    };
  },
});

export const getDailyBriefing = tool({
  description: 'Get a summary of tasks and notes for the last 24 hours to provide a daily briefing',
  parameters: z.object({}),
  execute: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get Tasks
    const tasks = await db.task.findMany({
      where: { status: 'pending' },
      orderBy: { dueDate: 'asc' },
    });

    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
    const dueToday = tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow);
    
    // Get Recent Notes (Last 24 hours)
    const recentNotes = await db.note.findMany({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      summary: {
        overdueCount: overdue.length,
        dueTodayCount: dueToday.length,
        recentNotesCount: recentNotes.length,
      },
      data: {
        overdue,
        dueToday,
        recentNotes,
      },
    };
  },
});

export const getSmartReminders = tool({
  description: 'Get intelligent reminders for overdue tasks and high-priority items',
  parameters: z.object({}),
  execute: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingTasks = await db.task.findMany({
      where: { status: 'pending' },
      orderBy: { dueDate: 'asc' },
    });

    const overdue = pendingTasks.filter((t) => t.dueDate && t.dueDate < today);
    const urgent = pendingTasks.filter((t) => {
      if (!t.dueDate) return false;
      const daysUntilDue = Math.ceil((t.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 1 && daysUntilDue >= 0;
    });

    const reminders: any[] = [];

    if (overdue.length > 0) {
      reminders.push({
        type: 'overdue',
        priority: 'critical',
        message: `You have ${overdue.length} overdue ${overdue.length === 1 ? 'task' : 'tasks'}!`,
        tasks: overdue.slice(0, 3),
      });
    }

    if (urgent.length > 0) {
      reminders.push({
        type: 'urgent',
        priority: 'high',
        message: `${urgent.length} ${urgent.length === 1 ? 'task is' : 'tasks are'} due soon!`,
        tasks: urgent,
      });
    }

    if (pendingTasks.length > 5) {
      reminders.push({
        type: 'accumulation',
        priority: 'medium',
        message: `You have ${pendingTasks.length} pending tasks. Consider breaking them down or prioritizing.`,
        count: pendingTasks.length,
      });
    }

    return {
      success: true,
      hasReminders: reminders.length > 0,
      reminders,
      totalPending: pendingTasks.length,
    };
  },
});
