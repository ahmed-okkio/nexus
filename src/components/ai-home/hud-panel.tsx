"use client";

import { motion } from "framer-motion";
import type { HudPanelData } from "./types";

export function HudPanel({
  panel,
  className,
  onAction,
}: {
  panel: HudPanelData;
  className?: string;
  onAction?: (panelId: string) => void;
}) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-3xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/90">{panel.title}</h3>
        {panel.badge ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-blue-100/90">
            {panel.badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {panel.items.map((item) => (
          <div key={item.label} className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
            <p className="text-sm text-white/90">{item.label}</p>
            <p className="text-xs text-blue-100/65">{item.sublabel}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAction?.(panel.id)}
        className="mt-4 text-xs text-blue-100/80 transition hover:text-white"
      >
        {panel.action} <span aria-hidden="true">&rarr;</span>
      </button>
    </motion.section>
  );
}
