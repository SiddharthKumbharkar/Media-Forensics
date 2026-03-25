export interface VideoModelResult {
  probability?: number;
  prediction?: string;
  class?: string;
  inference_time?: number;
  model?: string;
  error?: string;
  [key: string]: unknown;
}

export interface VideoForensicsResult {
  request_id: string;
  is_likely_deepfake: boolean;
  deepfake_probability: number;
  model_count: number;
  fake_votes: number;
  real_votes: number;
  response_time: number;
  ensemble_method_used: string;
  model_results?: Record<string, VideoModelResult>;
  processing_mode?: string;
  media_type_processed?: string;
  filename?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isVideoForensicsResult(value: unknown): value is VideoForensicsResult {
  if (!isRecord(value)) return false;

  if (typeof value.request_id !== "string") return false;
  if (typeof value.is_likely_deepfake !== "boolean") return false;
  if (typeof value.deepfake_probability !== "number") return false;
  if (typeof value.model_count !== "number") return false;
  if (typeof value.fake_votes !== "number") return false;
  if (typeof value.real_votes !== "number") return false;
  if (typeof value.response_time !== "number") return false;
  if (typeof value.ensemble_method_used !== "string") return false;

  const maybeModels = value.model_results;
  if (maybeModels !== undefined && !isRecord(maybeModels)) return false;

  return true;
}
