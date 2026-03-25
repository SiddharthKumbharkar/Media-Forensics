export interface Layer1Metadata {
  exif_consistent: boolean;
  physics_violations: string[];
  exif_score: number;
}

export interface Layer1Steganography {
  lsb_anomaly: boolean;
  dct_anomaly: boolean;
  steg_score: number;
}

export interface Layer1PRNU {
  noise_variance: number;
  spatial_correlation: number;
  prnu_score: number;
}

export interface Layer1C2PA {
  c2pa_present: boolean;
  c2pa_verified: boolean;
  c2pa_score: number;
  note: string;
}

export interface MLPrediction {
  label: "AI" | "Real";
  confidence: number;
  model: string;
}

export interface ForensicSignals {
  c2pa: Layer1C2PA;
  exif_score: number;
  steg_score: number;
  prnu_score: number;
  exif_consistent: boolean;
  lsb_anomaly: boolean;
  dct_anomaly: boolean;
}

export interface Layer1Output {
  authenticity_score: number;
  verdict: string;
  ml_prediction: MLPrediction;
  forensic_signals: ForensicSignals;
  c2pa: Layer1C2PA;
  metadata: Layer1Metadata;
  steganography: Layer1Steganography;
  prnu: Layer1PRNU;
  layer1_score: number;
  processing_ms?: number;
}

export function isLayer1Output(value: unknown): value is Layer1Output {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;
  const metadata = payload.metadata as Record<string, unknown> | undefined;
  const steganography = payload.steganography as Record<string, unknown> | undefined;
  const prnu = payload.prnu as Record<string, unknown> | undefined;
  const mlPrediction = payload.ml_prediction as Record<string, unknown> | undefined;
  const c2pa = payload.c2pa as Record<string, unknown> | undefined;

  return (
    typeof payload.authenticity_score === "number" &&
    typeof payload.verdict === "string" &&
    !!mlPrediction &&
    typeof mlPrediction.label === "string" &&
    typeof mlPrediction.confidence === "number" &&
    typeof mlPrediction.model === "string" &&
    !!c2pa &&
    typeof c2pa.c2pa_present === "boolean" &&
    typeof c2pa.c2pa_verified === "boolean" &&
    typeof c2pa.c2pa_score === "number" &&
    typeof c2pa.note === "string" &&
    !!metadata &&
    typeof metadata.exif_consistent === "boolean" &&
    Array.isArray(metadata.physics_violations) &&
    typeof metadata.exif_score === "number" &&
    !!steganography &&
    typeof steganography.lsb_anomaly === "boolean" &&
    typeof steganography.dct_anomaly === "boolean" &&
    typeof steganography.steg_score === "number" &&
    !!prnu &&
    typeof prnu.noise_variance === "number" &&
    typeof prnu.spatial_correlation === "number" &&
    typeof prnu.prnu_score === "number" &&
    typeof payload.layer1_score === "number"
  );
}
