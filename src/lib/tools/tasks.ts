import { z } from 'zod';
import { db } from '@/lib/db';

const createTaskSchema = z.object({
  title: z.string().describe('The title of the task'),
  description: z.string().optional().describe('Optional detailed description of the task'),
  dueDate: z.string().optional().describe('Optional due date in ISO format (YYYY-MM-DD)'),
});

const getTasksSchema = z.object({
  status: z.enum(['pending', 'completed']).optional().describe('Filter by task status'),
});

const toggleTaskSchema = z.object({
  id: z.string().describe('The task ID'),
  status: z.enum(['pending', 'completed']).describe('The new status'),
});

export const createTask = {
  description: 'Create a new task with an optional due date and description',
  inputSchema: createTaskSchema,
  execute: async (params: { title: string; description?: string; dueDate?: string }) => {
    console.log("Creating task with params:", params);
    const task = await db.task.create({
      data: {
        title: params.title,
        description: params.description,
        dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
      },
    });
    console.log("Task created successfully:", task);
    return {
      success: true,
      task,
    };
  },
};

export const getTasks = {
  description: 'Get all tasks, ordered by creation date',
  inputSchema: getTasksSchema,
  execute: async (params: { status?: 'pending' | 'completed' }) => {
    const tasks = await db.task.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      tasks,
      count: tasks.length,
    };
  },
};

export const toggleTask = {
  description: 'Update task status (mark as completed or reopen)',
  inputSchema: toggleTaskSchema,
  execute: async (params: { id: string; status: 'pending' | 'completed' }) => {
    const task = await db.task.update({
      where: { id: params.id },
      data: { status: params.status },
    });
    return {
      success: true,
      task,
    };
  },
};

export const getDailyBriefing = {
  description: 'Get a summary of tasks for today - pending tasks and overdue items',
  inputSchema: z.object({}),
  execute: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = await db.task.findMany({
      where: { status: 'pending' },
      orderBy: { dueDate: 'asc' },
    });

    const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
    const dueToday = tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow);
    const upcoming = tasks.filter((t) => t.dueDate && t.dueDate >= tomorrow);
    const noDueDate = tasks.filter((t) => !t.dueDate);

    return {
      success: true,
      summary: {
        total: tasks.length,
        overdue: overdue.length,
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        noDueDate: noDueDate.length,
      },
      tasks: {
        overdue,
        dueToday,
        upcoming: upcoming.slice(0, 5),
        noDueDate,
      },
    };
  },
};

export const getSmartReminders = {
  description: 'Get intelligent reminders for overdue tasks and high-priority items',
  inputSchema: z.object({}),
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
};
