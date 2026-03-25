import type { VideoModelResult, VideoForensicsResult } from "@/lib/video-forensics/types";

export type Tone = "success" | "warning" | "danger";

export interface VerdictView {
  label: string;
  tone: Tone;
  chipLabel: string;
  summary: string;
}

export interface ModelSummary {
  id: string;
  title: string;
  probabilityPercent: number;
  prediction: string;
  inferenceTimeSec: number | null;
  hasError: boolean;
}

export interface TimelinePoint {
  id: string;
  label: string;
  position: number;
  score: number;
}

export interface TimelineInsight {
  mode: "frame" | "model" | "none";
  title: string;
  subtitle: string;
  points: TimelinePoint[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function toPercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function formatFixed(value: number | null | undefined, fractionDigits = 2): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(fractionDigits);
}

export function getVerdictView(result: VideoForensicsResult): VerdictView {
  const fakeProbability = Math.max(0, Math.min(1, result.deepfake_probability));
  const realProbability = 1 - fakeProbability;

  if (result.is_likely_deepfake) {
    if (fakeProbability >= 0.8) {
      return {
        label: "Likely AI-Generated",
        tone: "danger",
        chipLabel: "High Risk",
        summary: "Strong synthetic-manipulation indicators were detected by the ensemble.",
      };
    }

    return {
      label: "Potentially AI-Generated",
      tone: "warning",
      chipLabel: "Review Required",
      summary: "Moderate evidence of manipulation detected. Manual review is recommended.",
    };
  }

  if (realProbability >= 0.8) {
    return {
      label: "Likely Authentic",
      tone: "success",
      chipLabel: "Likely Real",
      summary: "Model consensus supports authenticity with high confidence.",
    };
  }

  return {
    label: "Potentially Authentic",
    tone: "warning",
    chipLabel: "Moderate Confidence",
    summary: "No strong deepfake signal detected, but confidence is moderate.",
  };
}

export function getModelSummaries(modelResults: VideoForensicsResult["model_results"]): ModelSummary[] {
  const entries = Object.entries(modelResults || {});
  if (entries.length === 0) return [];

  return entries.map(([modelName, payload]) => {
    const result = isRecord(payload) ? (payload as VideoModelResult) : {};
    const probability = normalizeProbability(result.probability);

    return {
      id: modelName,
      title: toTitle(modelName),
      probabilityPercent: toPercent(probability),
      prediction: getPredictionLabel(result),
      inferenceTimeSec: typeof result.inference_time === "number" ? result.inference_time : null,
      hasError: typeof result.error === "string",
    };
  });
}

export function getTimelineInsight(modelResults: VideoForensicsResult["model_results"]): TimelineInsight {
  const entries = Object.entries(modelResults || {});

  for (const [modelName, payload] of entries) {
    const series = extractNumericSeries(payload);
    if (!series || series.length < 4) continue;

    const points = series.map((score, idx) => ({
      id: `${modelName}-${idx}`,
      label: `Frame ${idx + 1}`,
      position: idx / Math.max(1, series.length - 1),
      score,
    }));

    return {
      mode: "frame",
      title: "Frame-level confidence timeline",
      subtitle: `Using temporal outputs from ${toTitle(modelName)}.`,
      points,
    };
  }

  const modelProbabilities = entries
    .map(([modelName, payload]) => {
      const result = isRecord(payload) ? (payload as VideoModelResult) : {};
      return {
        modelName,
        probability: normalizeProbability(result.probability),
      };
    })
    .filter((item) => typeof item.probability === "number");

  if (modelProbabilities.length > 0) {
    const points = modelProbabilities.map((item, idx) => ({
      id: `${item.modelName}-${idx}`,
      label: toTitle(item.modelName),
      position: idx / Math.max(1, modelProbabilities.length - 1),
      score: item.probability,
    }));

    return {
      mode: "model",
      title: "Model confidence distribution",
      subtitle: "Frame-level temporal arrays were not returned by backend models.",
      points,
    };
  }

  return {
    mode: "none",
    title: "No timeline data available",
    subtitle: "The backend response did not include temporal or model confidence detail.",
    points: [],
  };
}

function normalizeProbability(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  return Math.max(0, Math.min(1, value));
}

function getPredictionLabel(result: VideoModelResult): string {
  if (result.error) return "Model Error";
  const prediction = result.prediction || result.class;
  if (typeof prediction !== "string") return "Undetermined";
  if (prediction.toLowerCase() === "fake") return "Likely Fake";
  if (prediction.toLowerCase() === "real") return "Likely Real";
  return prediction;
}

function toTitle(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractNumericSeries(value: unknown): number[] | null {
  if (!isRecord(value)) return null;

  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    if (Array.isArray(current)) {
      if (current.length > 0 && current.every((item) => typeof item === "number" && Number.isFinite(item))) {
        return current.map((item) => normalizeProbability(item));
      }
      for (const item of current) stack.push(item);
      continue;
    }

    if (isRecord(current)) {
      for (const child of Object.values(current)) {
        stack.push(child);
      }
    }
  }

  return null;
}
