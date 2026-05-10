import { z } from 'zod';
import { db } from '@/lib/db';

const createNoteSchema = z.object({
  content: z.string().describe('The content of the note'),
});

const createNotesSchema = z.object({
  notes: z.array(z.string()).describe('An array of note contents'),
});

export const createNote = {
  description: 'Create a single new note',
  inputSchema: createNoteSchema,
  execute: async (params: { content: string }) => {
    const note = await db.note.create({
      data: { content: params.content },
    });
    return {
      success: true,
      note,
    };
  },
};

export const createNotes = {
  description: 'Create multiple new notes at once',
  inputSchema: createNotesSchema,
  execute: async (params: { notes: string[] }) => {
    const createdNotes = await Promise.all(
      params.notes.map((content) => db.note.create({ data: { content } }))
    );
    return {
      success: true,
      count: createdNotes.length,
      notes: createdNotes,
    };
  },
};

export const getNotes = {
  description: 'Get all notes',
  inputSchema: z.object({}),
  execute: async () => {
    const notes = await db.note.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      notes,
    };
  },
};
