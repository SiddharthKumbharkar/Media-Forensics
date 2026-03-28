import { isAnalysisResponse, type AnalysisResponse } from "@/lib/analysis/types";
import { forensicFetch } from "@/lib/api-client";

export async function analyzeAudioFile(file: File): Promise<AnalysisResponse> {
  return forensicFetch(
    "/api/analyze",
    file,
    isAnalysisResponse,
    "Audio analysis failed",
    "audio",
  );
}
