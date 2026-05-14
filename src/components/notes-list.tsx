"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Trash2 } from "lucide-react";

interface Note {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const notesRef = useRef<Note[]>([]);

  const clearPendingAnimations = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const reconcileNotes = useCallback((nextNotes: Note[]) => {
    clearPendingAnimations();
    const currentNotes = notesRef.current;
    const currentIds = new Set(currentNotes.map((note) => note.id));
    const nextIds = new Set(nextNotes.map((note) => note.id));
    const removedIds = currentNotes.map((note) => note.id).filter((id) => !nextIds.has(id));
    const hasNewItems = nextNotes.some((note) => !currentIds.has(note.id));

    if (removedIds.length === 0 || hasNewItems) {
      setNotes(nextNotes);
      return;
    }

    removedIds.forEach((removedId, index) => {
      const timeoutId = window.setTimeout(() => {
        setNotes((previous) => previous.filter((note) => note.id !== removedId));
      }, index * 130);
      timeoutsRef.current.push(timeoutId);
    });

    const finalizeId = window.setTimeout(() => {
      setNotes(nextNotes);
    }, removedIds.length * 130 + 20);
    timeoutsRef.current.push(finalizeId);
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notes");
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      reconcileNotes(data.notes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [reconcileNotes]);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void fetchNotes();
    }, 0);

    const handleUpdate = () => {
      void fetchNotes();
    };

    window.addEventListener('notes-updated', handleUpdate);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener('notes-updated', handleUpdate);
      clearPendingAnimations();
    };
  }, [fetchNotes]);

  const handleDeleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete note");
      await fetchNotes();
      window.dispatchEvent(new CustomEvent("notes-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-[600px] w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-white/45 p-4 font-semibold text-zinc-700 dark:border-zinc-700/70 dark:bg-zinc-900/30 dark:text-zinc-200">
        <FileText size={18} />
        My Notes
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Notes List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && (
          <div className="text-center text-zinc-400 mt-10">
            <p className="text-sm">Loading notes...</p>
          </div>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="text-center text-zinc-400 mt-10">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notes yet. Create one above!</p>
          </div>
        )}

        {!isLoading && (
          <AnimatePresence mode="popLayout">
          {notes.map((note) => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10, filter: "blur(2px)" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="group rounded-xl border border-zinc-200/90 bg-white/75 p-4 transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/55 dark:hover:bg-zinc-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 break-words line-clamp-3 dark:text-zinc-100">
                    {note.content}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-300">
                    {formatDate(note.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete note"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
