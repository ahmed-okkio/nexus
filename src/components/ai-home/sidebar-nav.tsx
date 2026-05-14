"use client";

import { Calendar, CheckSquare2, House, MessageSquare, NotebookPen, Settings, Sparkles } from "lucide-react";

const items = [
  { label: "Home", icon: House },
  { label: "Notes", icon: NotebookPen },
  { label: "Tasks", icon: CheckSquare2 },
  { label: "Calendar", icon: Calendar },
  { label: "Messages", icon: MessageSquare },
  { label: "Insights", icon: Sparkles },
] as const;

export type SidebarItem = (typeof items)[number]["label"] | "Settings";

export function SidebarNav({
  activeItem,
  onSelect,
  onOpenSettings,
}: {
  activeItem: SidebarItem;
  onSelect: (item: SidebarItem) => void;
  onOpenSettings: () => void;
}) {
  return (
    <aside className="hidden h-[calc(100vh-2rem)] w-20 shrink-0 flex-col justify-between rounded-[2rem] border border-white/10 bg-white/5 px-3 py-4 backdrop-blur-xl lg:flex">
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item.label)}
            aria-pressed={activeItem === item.label}
            className={`flex w-full flex-col items-center gap-1 rounded-2xl p-2 text-[11px] transition ${
              activeItem === item.label
                ? "border border-blue-200/30 bg-white/10 text-white"
                : "text-blue-100/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex w-full flex-col items-center gap-1 rounded-2xl p-2 text-[11px] text-blue-100/70 transition hover:bg-white/5 hover:text-white"
      >
        <Settings size={17} />
        Settings
      </button>
    </aside>
  );
}
