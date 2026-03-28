import { isAnalysisResponse, type AnalysisResponse } from "@/lib/analysis/types";
import { forensicFetch } from "@/lib/api-client";

export async function analyzeImageFile(file: File): Promise<AnalysisResponse> {
  return forensicFetch(
    "/api/analyze",
    file,
    isAnalysisResponse,
    "Image analysis failed",
    "image",
  );
}
