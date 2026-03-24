import type { AudioForensicsResult } from "@/lib/audio-forensics/types";

export type Tone = "success" | "warning" | "danger";

export interface VerdictView {
  label: string;
  tone: Tone;
  chipLabel: string;
  summary: string;
}

export function toPercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function formatFixed(value: number, fractionDigits = 2): string {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : "-";
}

export function getVerdictView(verdict: AudioForensicsResult["final_verdict"]): VerdictView {
  switch (verdict) {
    case "AUTHENTIC":
      return {
        label: "Likely Authentic",
        tone: "success",
        chipLabel: "Likely Real",
        summary: "High authenticity confidence with coherent ENF, voice, and acoustic signatures.",
      };
    case "SUSPICIOUS":
      return {
        label: "Suspicious",
        tone: "warning",
        chipLabel: "Review Required",
        summary: "Mixed forensic indicators were detected. Manual review is recommended.",
      };
    case "LIKELY_FAKE":
      return {
        label: "Likely AI/Tampered",
        tone: "danger",
        chipLabel: "Likely AI/Tampered",
        summary: "Low authenticity confidence with multiple anomalies in forensic layers.",
      };
    default:
      return {
        label: "Inconclusive",
        tone: "warning",
        chipLabel: "Inconclusive",
        summary: "Insufficient evidence for a conclusive verdict.",
      };
  }
}
