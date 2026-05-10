import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';

export const createNote = tool({
  description: 'Create a single new note',
  parameters: z.object({
    content: z.string().describe('The content of the note'),
  }),
  execute: async ({ content }) => {
    const note = await db.note.create({
      data: { content },
    });
    return {
      success: true,
      note,
    };
  },
});

export const createNotes = tool({
  description: 'Create multiple new notes at once',
  parameters: z.object({
    notes: z.array(z.string()).describe('An array of note contents'),
  }),
  execute: async ({ notes }) => {
    const createdNotes = await Promise.all(
      notes.map((content) => db.note.create({ data: { content } }))
    );
    return {
      success: true,
      count: createdNotes.length,
      notes: createdNotes,
    };
  },
});

export const getNotes = tool({
  description: 'Get all notes',
  parameters: z.object({}),
  execute: async () => {
    const notes = await db.note.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      notes,
    };
  },
});
