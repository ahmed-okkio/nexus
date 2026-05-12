import { ChatInterface } from "@/components/chat-interface";
import { TasksList } from "@/components/TasksList";
import { NotesList } from "@/components/notes-list";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Nexus</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Your personal AI assistant</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Chat - Takes 2 cols on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <ChatInterface />
            </div>
          </div>

          {/* Sidebar - Tasks and Notes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tasks */}
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
              <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Tasks</h2>
              <TasksList />
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <NotesList />
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
              <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">Quick Actions</h2>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200 text-sm font-medium transition-colors">
                  Daily Briefing
                </button>
                <button className="w-full px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 text-sm font-medium transition-colors">
                  View All Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-zinc-50 dark:bg-zinc-950 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>Nexus &mdash; Made for the LOS Hackathon 2026</p>
        </div>
      </footer>
    </div>
  );
}
