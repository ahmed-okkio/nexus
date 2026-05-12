"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, Edit3, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

import useSWR, { useSWRConfig } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NotesList() {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR("/api/notes", fetcher);
  const notes = data?.notes || [];
  
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [localError, setInternalError] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      setIsAdding(true);
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent }),
      });

      if (!response.ok) throw new Error("Failed to create note");
      setNewNoteContent("");
      mutate("/api/notes");
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete note");
      mutate("/api/notes");
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : "Failed to delete note");
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
    <div className="flex flex-col h-[600px] w-full max-w-2xl border rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-zinc-50 font-semibold flex items-center gap-2 text-zinc-700">
        <FileText size={18} />
        My Notes
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add Note Section */}
      <div className="p-4 border-b bg-blue-50 space-y-2">
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Add a new note..."
          className="w-full p-3 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none"
          rows={2}
        />
        <button
          onClick={handleAddNote}
          disabled={isAdding || !newNoteContent.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Plus size={16} />
          {isAdding ? "Adding..." : "Add Note"}
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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

        {!isLoading &&
          notes.map((note) => (
            <div
              key={note.id}
              className="p-4 border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-white transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 break-words line-clamp-3">
                    {note.content}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
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
            </div>
          ))}
      </div>
    </div>
  );
}
