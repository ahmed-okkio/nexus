"use client";

import { motion } from "framer-motion";
import type { AiState } from "./types";

const pulseByState: Record<AiState, number> = {
  idle: 1,
  listening: 1.22,
  thinking: 1.1,
  responding: 1.15,
};

export function AssistantOrb({ state, compact = false, voicePulse = 0 }: { state: AiState; compact?: boolean; voicePulse?: number }) {
  const outerSize = compact ? "h-[120px] w-[120px] sm:h-[120px] sm:w-[120px]" : "h-[260px] w-[260px] sm:h-[360px] sm:w-[360px]";
  const particleOffset = compact ? -54 : -164;
  const pulseBoost = Math.min(0.4, voicePulse * 0.4);
  return (
    <motion.div
      className={`relative flex items-center justify-center ${outerSize}`}
      animate={{ scale: 1 + voicePulse * 0.2 }}
      transition={{ duration: 0.08, ease: "easeOut" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-[14%] rounded-full bg-radial from-violet-200/35 via-blue-300/20 to-transparent blur-xl"
        animate={{
          scale: 1 + voicePulse * 0.55,
          opacity: 0.2 + voicePulse * 0.78,
        }}
        transition={{ duration: 0.08, ease: "easeOut" }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-radial from-violet-200/35 via-blue-400/15 to-transparent blur-2xl"
        animate={{
          scale: [1, pulseByState[state] + pulseBoost, 1],
          opacity: state === "idle" ? [0.4, 0.55 + voicePulse * 0.2, 0.4] : [0.6, 0.95 + voicePulse * 0.2, 0.6],
        }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute h-[90%] w-[90%] rounded-full border border-blue-200/25"
        animate={{ rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute h-[80%] w-[80%] rounded-full border border-violet-200/20"
        animate={{ rotate: -360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute h-[104%] w-[104%] rounded-full border border-dashed border-violet-100/20"
        animate={{ rotate: 360, opacity: [0.3, 0.65, 0.3] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />

      {Array.from({ length: 14 }).map((_, index) => (
        <motion.span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-blue-100/70"
          style={{
            transform: `rotate(${index * 25.7}deg) translateY(${particleOffset}px)`,
          }}
          animate={{ opacity: [0.25, 0.95, 0.25], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.09 }}
        />
      ))}

      <motion.div
        className="relative h-[64%] w-[64%] rounded-full bg-linear-to-br from-blue-100 via-indigo-300 to-violet-300 shadow-[0_0_80px_rgba(124,151,255,0.5)]"
        animate={{
          scale: [1, 1.06 + pulseBoost, 1],
          boxShadow: [
            "0 0 45px rgba(124,151,255,0.45)",
            `0 0 ${85 + Math.round(voicePulse * 64)}px rgba(146,128,255,0.72)`,
            "0 0 45px rgba(124,151,255,0.45)",
          ],
        }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-[10%] rounded-full bg-radial from-white/90 via-indigo-100/30 to-indigo-900/65" />
        <div className="absolute inset-[28%] rounded-full bg-white/40 blur-xl" />
      </motion.div>
    </motion.div>
  );
}
