import type {
  AnalysisBreakdownItem,
  AnalysisEngineLabel,
  AnalysisResponse,
  AnalysisVerdict,
} from "@/lib/analysis/types";

export type Tone = "success" | "warning" | "danger";

export interface VerdictView {
  label: AnalysisVerdict;
  tone: Tone;
  chipLabel: string;
  summary: string;
}

export function toPercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function getVerdictView(verdict: AnalysisVerdict | undefined): VerdictView {
  switch (verdict) {
    case "Likely Real":
      return {
        label: "Likely Real",
        tone: "success",
        chipLabel: "Low Risk",
        summary: "The active analysis engine found low evidence of synthetic or manipulated content.",
      };
    case "Likely AI":
      return {
        label: "Likely AI",
        tone: "danger",
        chipLabel: "High Risk",
        summary: "The active analysis engine found strong evidence of synthetic or manipulated content.",
      };
    case "Review Required":
      return {
        label: "Review Required",
        tone: "warning",
        chipLabel: "Review",
        summary: "Signals are mixed enough that a manual review is recommended.",
      };
    default:
      return {
        label: "Inconclusive",
        tone: "warning",
        chipLabel: "Mixed Signals",
        summary: "The current analysis did not collect enough evidence for a stronger verdict.",
      };
  }
}

export function getEngineDescription(engine: AnalysisEngineLabel): string {
  return engine === "Enhanced" ? "Enhanced" : "Standard";
}

export function getBreakdownLabel(source: AnalysisBreakdownItem["source"]): AnalysisEngineLabel {
  return source === "external" ? "Enhanced" : "Standard";
}

export function getBreakdownEntries(result: AnalysisResponse | null): AnalysisBreakdownItem[] {
  if (!result?.breakdown) return [];

  return [result.breakdown.internal, result.breakdown.external].filter(
    (item): item is AnalysisBreakdownItem => Boolean(item),
  );
}
