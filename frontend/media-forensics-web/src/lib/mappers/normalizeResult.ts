import type {
  AnalysisVerdict,
  MediaType,
  NormalizedResult,
} from "@/lib/analysis/types";

const AI_THRESHOLD = 0.75;
const REAL_THRESHOLD = 0.25;
const INCONCLUSIVE_MIN = 0.45;
const INCONCLUSIVE_MAX = 0.55;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function clampUnitInterval(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  return Math.max(0, Math.min(1, value));
}

function extractNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function extractString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function extractBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function normalizeVerdictText(value: string): string {
  return value.trim().toLowerCase();
}

export function scoreToVerdict(fakeProbability: number): AnalysisVerdict {
  if (fakeProbability >= AI_THRESHOLD) return "Likely AI";
  if (fakeProbability <= REAL_THRESHOLD) return "Likely Real";
  if (fakeProbability >= INCONCLUSIVE_MIN && fakeProbability <= INCONCLUSIVE_MAX) return "Inconclusive";
  return "Review Required";
}

function verdictToProbability(verdict: string | undefined): number | undefined {
  if (!verdict) return undefined;

  const normalized = normalizeVerdictText(verdict);

  if (normalized.includes("likely ai") || normalized.includes("tampered") || normalized === "fake" || normalized.includes("likely fake")) {
    return 0.9;
  }

  if (normalized.includes("likely real") || normalized === "real" || normalized.includes("authentic")) {
    return 0.1;
  }

  if (normalized.includes("inconclusive") || normalized.includes("undetermined")) {
    return 0.5;
  }

  if (normalized.includes("review") || normalized.includes("suspicious") || normalized.includes("potential")) {
    return 0.6;
  }

  return undefined;
}

function deriveConfidence(fakeProbability: number, explicitConfidence?: number): number {
  const normalizedExplicit = explicitConfidence !== undefined ? clampUnitInterval(explicitConfidence) : undefined;
  const directionalConfidence = Math.max(fakeProbability, 1 - fakeProbability);

  if (normalizedExplicit === undefined) {
    return directionalConfidence;
  }

  return clampUnitInterval((normalizedExplicit + directionalConfidence) / 2);
}

function inferProbability(payload: Record<string, unknown>): number | undefined {
  const directFakeScore = extractNumber(payload, [
    "is_fake_probability",
    "fake_probability",
    "deepfake_probability",
    "ensemble_score_is_fake",
    "risk_score",
    "ai_risk_score",
  ]);
  if (directFakeScore !== undefined) {
    return clampUnitInterval(directFakeScore);
  }

  for (const nestedKey of ["video", "audio", "result"] as const) {
    const nestedPayload = payload[nestedKey];
    if (isRecord(nestedPayload)) {
      const nestedScore = inferProbability(nestedPayload);
      if (nestedScore !== undefined) {
        return clampUnitInterval(nestedScore);
      }
    }
  }

  const authenticityScore = extractNumber(payload, [
    "authenticity_score",
    "real_probability",
    "real_score",
    "not_fake_probability",
  ]);
  if (authenticityScore !== undefined) {
    return 1 - clampUnitInterval(authenticityScore);
  }

  const genericProbability = extractNumber(payload, ["probability", "score", "confidence_score"]);
  const genericVerdict = extractString(payload, ["verdict", "label", "class", "prediction", "final_verdict"]);
  if (genericProbability !== undefined && genericVerdict) {
    const normalizedProbability = clampUnitInterval(genericProbability);
    const normalizedVerdict = normalizeVerdictText(genericVerdict);

    if (normalizedVerdict.includes("fake") || normalizedVerdict.includes("ai")) {
      return normalizedProbability;
    }

    if (normalizedVerdict.includes("real") || normalizedVerdict.includes("authentic")) {
      return 1 - normalizedProbability;
    }
  }

  const booleanHint = extractBoolean(payload, ["is_likely_deepfake", "is_fake", "is_ai"]);
  if (booleanHint !== undefined) {
    return booleanHint ? 0.85 : 0.15;
  }

  return verdictToProbability(genericVerdict);
}

function inferVerdict(payload: Record<string, unknown>, fakeProbability: number): AnalysisVerdict {
  const explicitVerdict = extractString(payload, ["verdict", "final_verdict", "label", "class", "prediction"]);
  if (!explicitVerdict) {
    return scoreToVerdict(fakeProbability);
  }

  const normalized = normalizeVerdictText(explicitVerdict);

  if (normalized.includes("review") || normalized.includes("suspicious")) {
    return "Review Required";
  }
  if (normalized.includes("inconclusive") || normalized.includes("undetermined")) {
    return "Inconclusive";
  }
  if (normalized.includes("real") || normalized.includes("authentic")) {
    return "Likely Real";
  }
  if (normalized.includes("ai") || normalized.includes("fake") || normalized.includes("tampered")) {
    return "Likely AI";
  }

  return scoreToVerdict(fakeProbability);
}

function inferConfidence(payload: Record<string, unknown>, fakeProbability: number): number {
  const explicitConfidence = extractNumber(payload, [
    "confidence",
    "overall_confidence",
    "confidence_in_verdict",
    "confidence_score",
  ]);

  return deriveConfidence(fakeProbability, explicitConfidence);
}

function normalizePayload(payload: unknown, source: NormalizedResult["source"]): NormalizedResult {
  if (!isRecord(payload)) {
    throw new Error("Analysis response could not be normalized");
  }

  const fakeProbability = inferProbability(payload);
  if (fakeProbability === undefined) {
    throw new Error("Analysis response is missing a recognizable score");
  }

  const verdict = inferVerdict(payload, fakeProbability);
  const confidence = inferConfidence(payload, fakeProbability);

  return {
    fake_probability: clampUnitInterval(fakeProbability),
    verdict,
    confidence,
    uncertainty_score: clampUnitInterval(1 - confidence),
    source,
  };
}

export function normalizeInternalResult(_mediaType: MediaType, payload: unknown): NormalizedResult {
  return normalizePayload(payload, "internal");
}

export function normalizeExternalResult(payload: unknown): NormalizedResult {
  return normalizePayload(payload, "external");
}

export function fuseNormalizedResults(externalResult: NormalizedResult, internalResult: NormalizedResult) {
  const finalScore = clampUnitInterval((0.7 * externalResult.fake_probability) + (0.3 * internalResult.fake_probability));
  const confidence = clampUnitInterval((0.7 * externalResult.confidence) + (0.3 * internalResult.confidence));
  const disagreement = Math.abs(externalResult.fake_probability - internalResult.fake_probability);
  const uncertainty = clampUnitInterval((disagreement + (externalResult.uncertainty_score ?? 1 - externalResult.confidence) + (internalResult.uncertainty_score ?? 1 - internalResult.confidence)) / 3);

  return {
    final_score: finalScore,
    final_verdict: scoreToVerdict(finalScore),
    confidence,
    uncertainty_score: uncertainty,
  };
}
