import { isVideoForensicsResult, type VideoForensicsResult } from "@/lib/video-forensics/types";
import { forensicFetch } from "@/lib/api-client";

export async function analyzeVideoFile(file: File): Promise<VideoForensicsResult> {
  return forensicFetch(
    "/api/video-forensics",
    file,
    isVideoForensicsResult,
    "Video analysis failed"
  );
}
