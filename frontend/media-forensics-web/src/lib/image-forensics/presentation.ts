import type { Layer1Output } from "@/lib/image-forensics/types";

export type VerdictTone = "success" | "warning" | "danger";

export interface Verdict {
  label: string;
  tone: VerdictTone;
  summary: string;
}

const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const REVIEW_THRESHOLD = 0.45;

export function toPercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function getVerdictFromLayer1Score(score: number): Verdict {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) {
    return {
      label: "Likely Authentic",
      tone: "success",
      summary: "High authenticity confidence. Strong forensic consistency across metadata, steg, and PRNU signals.",
    };
  }

  if (score >= REVIEW_THRESHOLD) {
    return {
      label: "Review Required",
      tone: "warning",
      summary: "Medium authenticity confidence. Mixed forensic indicators were found, so manual review is recommended.",
    };
  }

  return {
    label: "Likely Manipulated",
    tone: "danger",
    summary: "Low authenticity confidence. Multiple forensic checks suggest potential tampering or synthetic generation.",
  };
}

export function getVerdictFromUnifiedResult(result: Layer1Output): Verdict {
  const verdictText = (result.verdict || "").toLowerCase();

  if (verdictText.includes("likely real")) {
    return {
      label: "Likely Authentic",
      tone: "success",
      summary: "Unified forensic + ML fusion indicates this image is likely authentic.",
    };
  }

  if (verdictText.includes("review")) {
    return {
      label: "Review Required",
      tone: "warning",
      summary: "Signals are mixed across forensic checks and ML inference. Manual review is recommended.",
    };
  }

  if (verdictText.includes("ai") || verdictText.includes("tampered")) {
    return {
      label: "Likely AI/Tampered",
      tone: "danger",
      summary: "Unified analysis indicates elevated risk of AI generation or manipulation.",
    };
  }

  return getVerdictFromLayer1Score(result.authenticity_score);
}

export function getSignalAgreementConfidence(result: Layer1Output): number {
  const signals = [result.metadata.exif_score, result.steganography.steg_score, result.prnu.prnu_score];
  const mean = signals.reduce((sum, value) => sum + value, 0) / signals.length;
  const variance = signals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / signals.length;
  const standardDeviation = Math.sqrt(variance);

  return Math.max(0, Math.min(1, 1 - standardDeviation));
}

export function formatFixed(value: number, fractionDigits = 4): string {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : "-";
}
