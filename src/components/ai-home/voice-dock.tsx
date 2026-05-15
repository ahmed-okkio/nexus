"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Sparkles } from "lucide-react";
import type { AiState } from "./types";

const stateLabel: Record<AiState, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  responding: "Responding",
};

const helperCopy: Record<AiState, string> = {
  idle: "How can I help today?",
  listening: "I am listening. Speak naturally.",
  thinking: "Thinking through context and intent.",
  responding: "Building a response and suggested actions.",
};

export function VoiceDock({
  state,
  isListening,
  isVoiceActive,
  voiceEnergy,
  micEnabled,
  isSupported,
  transcript,
  displayText,
  isResponding,
  onMicToggle,
  wakeFlashActive,
}: {
  state: AiState;
  isListening: boolean;
  isVoiceActive: boolean;
  voiceEnergy: number;
  micEnabled: boolean;
  isSupported: boolean;
  transcript: string;
  displayText: string;
  isResponding: boolean;
  onMicToggle: () => void;
  wakeFlashActive: boolean;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleLine, setVisibleLine] = useState("How can I help today?");
  const [showLine, setShowLine] = useState(true);
  const [finalLineSettled, setFinalLineSettled] = useState(false);
  const targetText = useMemo(() => displayText.trim() || "How can I help today?", [displayText]);
  const lines = useMemo(() => {
    const words = targetText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return ["How can I help today?"];
    const result: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 62 && current) {
        result.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      result.push(current);
    }
    return result;
  }, [targetText]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setLineIndex(0);
      setVisibleLine(lines[0] ?? "How can I help today?");
      setShowLine(true);
      setFinalLineSettled(lines.length <= 1);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [lines]);

  useEffect(() => {
    const currentLine = lines[lineIndex];
    if (!currentLine) {
      return;
    }
    if (lineIndex === lines.length - 1) {
      const settleTimer = window.setTimeout(() => {
        setFinalLineSettled(true);
      }, 460);
      return () => window.clearTimeout(settleTimer);
    }

    const holdTimer = window.setTimeout(() => {
      setShowLine(false);
      const nextLineTimer = window.setTimeout(() => {
        setLineIndex((prev) => prev + 1);
        setVisibleLine(lines[lineIndex + 1] ?? currentLine);
        setShowLine(true);
      }, 170);
      return () => window.clearTimeout(nextLineTimer);
    }, 1450);

    return () => window.clearTimeout(holdTimer);
  }, [lineIndex, lines]);

  const listeningVisual = state === "listening" || isVoiceActive || wakeFlashActive;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="text-center">
        <div className="relative min-h-[7.5rem] sm:min-h-[8.25rem]">
          <AnimatePresence mode="wait">
            {showLine ? (
              <motion.p
                key={`${lineIndex}-${visibleLine}`}
                initial={{ opacity: 0, y: 26, filter: "blur(10px)", scale: 0.985 }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
                exit={{ opacity: 0, y: -12, filter: "blur(7px)", scale: 0.985 }}
                transition={{ duration: 0.46, ease: [0.19, 1, 0.22, 1] }}
                className="text-5xl font-semibold tracking-tight text-white sm:text-6xl"
              >
                {visibleLine}
                {isResponding ? <span className="ml-1 inline-block animate-pulse text-blue-200">|</span> : null}
              </motion.p>
            ) : null}
          </AnimatePresence>
          {finalLineSettled ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 rounded-2xl bg-radial from-blue-200/20 via-transparent to-transparent blur-xl"
            />
          ) : null}
        </div>
        <p className="mt-3 text-xl text-blue-100/70">{helperCopy[state]}</p>
      </div>

      <motion.div
        className="relative rounded-[2.6rem] border border-blue-200/35 bg-linear-to-r from-blue-500/14 via-transparent to-violet-500/15 p-3 backdrop-blur-xl"
        animate={
          listeningVisual
            ? {
                boxShadow: "0 0 42px rgba(120,150,255,0.45)",
                borderColor: "rgba(196,181,253,0.8)",
              }
            : { boxShadow: "0 0 0 rgba(0,0,0,0)", borderColor: "rgba(191,219,254,0.35)" }
        }
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <AnimatePresence>
          {listeningVisual ? (
            <motion.div
              key="listening-activation-pulse"
              className="pointer-events-none absolute inset-0 rounded-[2.6rem] border border-violet-200/70"
              initial={{ opacity: 0.95, scale: 0.98 }}
              animate={{ opacity: 0, scale: 1.04 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          ) : null}
        </AnimatePresence>
        <motion.div
          className="flex items-center gap-4 rounded-[2.2rem] border border-white/12 bg-black/20 px-5 py-4"
          animate={
            listeningVisual
              ? {
                  boxShadow: "inset 0 0 36px rgba(140,165,255,0.25)",
                }
              : { boxShadow: "inset 0 0 0 rgba(0,0,0,0)" }
          }
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-blue-100/70" />
              <span className="text-sm uppercase tracking-[0.26em] text-blue-100/70">{stateLabel[state]}</span>
            </div>
            <motion.div
              className="flex h-10 w-full items-end justify-center gap-1.5"
              animate={{ opacity: listeningVisual ? 1 : 0.55, scale: listeningVisual ? 1.02 : 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {Array.from({ length: 34 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="w-1.5 rounded-full bg-linear-to-t from-blue-200/70 to-violet-100"
                  animate={{
                    height: isVoiceActive ? [6, 12 + voiceEnergy * 28, 9 + voiceEnergy * 9, 14 + voiceEnergy * 18, 8] : 4,
                  }}
                  transition={{
                    duration: isVoiceActive ? 0.35 : 1.05,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: Math.abs(i - 17) * 0.012,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </div>
          <button
            type="button"
            onClick={onMicToggle}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
              micEnabled
                ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-50 hover:bg-emerald-300/15"
                : "border-white/15 bg-white/5 text-blue-100/80 hover:bg-white/10"
            }`}
          >
            {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            {micEnabled ? "Mic on" : "Mic muted"}
          </button>
        </motion.div>
      </motion.div>

      <p className="text-center text-sm text-blue-100/65">
        {isSupported ? "Always listening. Start commands with Nexus." : "Speech recognition is not supported in this browser."}{" "}
        Type instead:{" "}
        <span className="text-blue-50">
          &quot;Summarize my morning and prep my meetings.&quot;
        </span>
      </p>
      {isSupported ? (
        <p className="text-center text-xs text-blue-100/55">
          Status: {micEnabled ? (state === "listening" ? "Listening after wake word" : isListening ? "Idle - waiting for Nexus" : "Reconnecting listener") : "Microphone muted"}
        </p>
      ) : null}
      {transcript ? (
        <p className="text-center text-sm text-blue-100/75">
          Command: <span className="text-white">{transcript}</span>
        </p>
      ) : null}
    </div>
  );
}
