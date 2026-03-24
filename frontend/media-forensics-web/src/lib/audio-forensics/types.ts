export type AudioVerdict = "AUTHENTIC" | "SUSPICIOUS" | "LIKELY_FAKE" | "INCONCLUSIVE";

export interface AudioLayerScores {
  enf_score: number | null;
  prosody_score: number | null;
  glottal_score: number | null;
  room_acoustic_score: number | null;
}

export interface EnfAnalysis {
  enf_present: boolean;
  dominant_grid_hz: number | null;
  inferred_region: string;
  enf_snr_db: number;
  enf_std_hz: number;
  enf_mean_drift_rate: number;
  enf_consistency_score: number;
  splice_detected: boolean;
  splice_locations_sec: number[];
  enf_time_series: number[];
  enf_timestamps_sec: number[];
  flags: string[];
  confidence: number;
}

export interface ProsodicAnalysis {
  prosody_naturalness_score: number;
  jitter_local_percent: number;
  shimmer_local_percent: number;
  syllable_interval_cv: number;
  anomalies: string[];
  confidence: number;
}

export interface GlottalAnalysis {
  glottal_naturalness_score: number;
  anomalies: string[];
  confidence: number;
}

export interface RoomAcousticAnalysis {
  room_consistency_score: number;
  acoustic_environment: string;
  splice_suspected: boolean;
  early_reflections_detected: boolean;
  flags: string[];
  confidence: number;
  drr_db: number;
}

export interface AudioForensicsResult {
  module: string;
  version: string;
  file_path: string;
  file_duration_sec: number;
  sample_rate_hz: number;
  is_speech: boolean;
  audio_format: string;
  final_verdict: AudioVerdict;
  authenticity_score: number;
  overall_confidence: number;
  layer_scores: AudioLayerScores;
  enf_analysis: EnfAnalysis;
  prosodic_analysis: ProsodicAnalysis;
  glottal_analysis: GlottalAnalysis;
  room_acoustic_analysis: RoomAcousticAnalysis;
  all_flags: string[];
  all_anomalies: string[];
  processing_time_sec: number;
  processing_ms?: number;
  error?: string | null;
}

export function isAudioForensicsResult(value: unknown): value is AudioForensicsResult {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;
  const layerScores = payload.layer_scores as Record<string, unknown> | undefined;

  return (
    typeof payload.authenticity_score === "number" &&
    typeof payload.overall_confidence === "number" &&
    typeof payload.final_verdict === "string" &&
    typeof payload.file_duration_sec === "number" &&
    typeof payload.sample_rate_hz === "number" &&
    Array.isArray(payload.all_flags) &&
    Array.isArray(payload.all_anomalies) &&
    !!layerScores &&
    (typeof layerScores.enf_score === "number" || layerScores.enf_score === null) &&
    (typeof layerScores.prosody_score === "number" || layerScores.prosody_score === null) &&
    (typeof layerScores.glottal_score === "number" || layerScores.glottal_score === null) &&
    (typeof layerScores.room_acoustic_score === "number" || layerScores.room_acoustic_score === null)
  );
}
