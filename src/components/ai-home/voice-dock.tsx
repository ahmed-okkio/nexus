"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
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
  isSupported,
  transcript,
  displayText,
  isResponding,
}: {
  state: AiState;
  isListening: boolean;
  isVoiceActive: boolean;
  voiceEnergy: number;
  isSupported: boolean;
  transcript: string;
  displayText: string;
  isResponding: boolean;
}) {
  const [animatedText, setAnimatedText] = useState("How can I help today?");
  const [lineIndex, setLineIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
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
    const timer = window.setTimeout(() => {
      setLineIndex(0);
      setAnimatedText("");
      setIsDeleting(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [lines]);

  useEffect(() => {
    const activeLine = lines[lineIndex] ?? lines[0] ?? "";
    if (!activeLine) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isDeleting) {
        const nextText = animatedText.slice(0, -1);
        setAnimatedText(nextText);
        if (nextText.length === 0) {
          setIsDeleting(false);
          setLineIndex((prev) => (prev + 1) % lines.length);
        }
        return;
      }

      if (animatedText.length < activeLine.length) {
        setAnimatedText(activeLine.slice(0, animatedText.length + 1));
        return;
      }

      if (lines.length > 1) {
        setIsDeleting(true);
      }
    }, isDeleting ? 24 : animatedText.length < activeLine.length ? 52 : 1700);

    return () => window.clearTimeout(timer);
  }, [animatedText, isDeleting, lineIndex, lines]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="text-center">
        <motion.p
          key={targetText}
          initial={{ opacity: 0.2, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="min-h-[7.5rem] text-5xl font-semibold tracking-tight text-white sm:min-h-[8.25rem] sm:text-6xl"
        >
          {animatedText}
          {isResponding ? <span className="ml-1 inline-block animate-pulse text-blue-200">|</span> : null}
        </motion.p>
        <p className="mt-3 text-xl text-blue-100/70">{helperCopy[state]}</p>
      </div>

      <div className="rounded-[2.6rem] border border-blue-200/35 bg-linear-to-r from-blue-500/14 via-transparent to-violet-500/15 p-3 backdrop-blur-xl">
        <div className="flex items-center gap-4 rounded-[2.2rem] border border-white/12 bg-black/20 px-5 py-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-blue-100/70" />
              <span className="text-sm uppercase tracking-[0.26em] text-blue-100/70">{stateLabel[state]}</span>
            </div>
            <motion.div className="flex h-10 w-full items-end justify-center gap-1.5" animate={{ opacity: isVoiceActive ? 1 : 0.55 }}>
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
        </div>
      </div>

      <p className="text-center text-sm text-blue-100/65">
        {isSupported ? "Always listening. Start commands with Nexus." : "Speech recognition is not supported in this browser."}{" "}
        Type instead:{" "}
        <span className="text-blue-50">
          &quot;Summarize my morning and prep my meetings.&quot;
        </span>
      </p>
      {isSupported ? (
        <p className="text-center text-xs text-blue-100/55">
          Status: {state === "listening" ? "Listening after wake word" : isListening ? "Idle - waiting for Nexus" : "Reconnecting listener"}
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
