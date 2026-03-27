import { isAudioForensicsResult, type AudioForensicsResult } from "@/lib/audio-forensics/types";
import { forensicFetch } from "@/lib/api-client";

export async function analyzeAudioFile(file: File): Promise<AudioForensicsResult> {
  return forensicFetch(
    "/api/audio-forensics",
    file,
    isAudioForensicsResult,
    "Audio analysis failed"
  );
}
