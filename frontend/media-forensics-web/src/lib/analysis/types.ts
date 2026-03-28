export type MediaType = "image" | "audio" | "video";

export type ForensicMode = "internal" | "external" | "hybrid";

export type AnalysisVerdict = "Likely Real" | "Likely AI" | "Inconclusive" | "Review Required";

export type AnalysisSource = "internal" | "external" | "hybrid";

export type AnalysisEngineLabel = "Standard" | "Enhanced";

export interface NormalizedResult {
  fake_probability: number;
  verdict: AnalysisVerdict;
  confidence: number;
  uncertainty_score?: number;
  source: "internal" | "external";
}

export interface AnalysisBreakdownItem extends NormalizedResult {
  latency_ms: number;
}

export interface AnalysisBreakdown {
  internal?: AnalysisBreakdownItem;
  external?: AnalysisBreakdownItem;
}

export interface AnalysisResponse {
  request_id: string;
  media_type: MediaType;
  source: AnalysisSource;
  mode_requested: ForensicMode;
  mode_used: AnalysisSource;
  analysis_engine: AnalysisEngineLabel;
  fake_probability: number;
  final_score: number;
  final_verdict: AnalysisVerdict;
  confidence: number;
  uncertainty_score?: number;
  processing_ms: number;
  cached: boolean;
  fallback_applied?: boolean;
  breakdown?: AnalysisBreakdown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNormalizedResult(value: unknown): value is NormalizedResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.fake_probability === "number" &&
    typeof value.verdict === "string" &&
    typeof value.confidence === "number" &&
    (value.uncertainty_score === undefined || typeof value.uncertainty_score === "number") &&
    (value.source === "internal" || value.source === "external")
  );
}

function isBreakdownItem(value: unknown): value is AnalysisBreakdownItem {
  return isNormalizedResult(value) && typeof (value as AnalysisBreakdownItem).latency_ms === "number";
}

export function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (!isRecord(value)) return false;

  const breakdown = value.breakdown;
  if (breakdown !== undefined) {
    if (!isRecord(breakdown)) return false;
    if (breakdown.internal !== undefined && !isBreakdownItem(breakdown.internal)) return false;
    if (breakdown.external !== undefined && !isBreakdownItem(breakdown.external)) return false;
  }

  return (
    typeof value.request_id === "string" &&
    (value.media_type === "image" || value.media_type === "audio" || value.media_type === "video") &&
    (value.source === "internal" || value.source === "external" || value.source === "hybrid") &&
    (value.mode_requested === "internal" || value.mode_requested === "external" || value.mode_requested === "hybrid") &&
    (value.mode_used === "internal" || value.mode_used === "external" || value.mode_used === "hybrid") &&
    (value.analysis_engine === "Standard" || value.analysis_engine === "Enhanced") &&
    typeof value.fake_probability === "number" &&
    typeof value.final_score === "number" &&
    typeof value.final_verdict === "string" &&
    typeof value.confidence === "number" &&
    (value.uncertainty_score === undefined || typeof value.uncertainty_score === "number") &&
    typeof value.processing_ms === "number" &&
    typeof value.cached === "boolean" &&
    (value.fallback_applied === undefined || typeof value.fallback_applied === "boolean")
  );
}
