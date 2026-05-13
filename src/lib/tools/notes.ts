import { z } from 'zod';
import { db } from '@/lib/db';

const createNoteSchema = z.object({
  content: z.string().describe('The content of the note'),
});

const createNotesSchema = z.object({
  notes: z.array(z.string()).describe('An array of note contents'),
});

const searchNotesSchema = z.object({
  query: z.string().describe('The text to search for in notes'),
});

const deleteNoteSchema = z.object({
  id: z.string().describe('The ID of the note to delete'),
});

const updateNoteSchema = z.object({
  id: z.string().describe('The ID of the note to update'),
  content: z.string().describe('The new content of the note'),
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

export const searchNotes = {
  description: 'Search for notes containing specific text',
  inputSchema: searchNotesSchema,
  execute: async (params: { query: string }) => {
    const notes = await db.note.findMany({
      where: {
        content: {
          contains: params.query,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      notes,
    };
  },
};

export const deleteNote = {
  description: 'Delete a note by its ID',
  inputSchema: deleteNoteSchema,
  execute: async (params: { id: string }) => {
    await db.note.delete({
      where: { id: params.id },
    });
    return {
      success: true,
      message: `Note ${params.id} deleted successfully`,
    };
  },
};

export const updateNote = {
  description: 'Update the content of an existing note',
  inputSchema: updateNoteSchema,
  execute: async (params: { id: string; content: string }) => {
    const note = await db.note.update({
      where: { id: params.id },
      data: { content: params.content },
    });
    return {
      success: true,
      note,
    };
  },
};
