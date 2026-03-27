import { isLayer1Output, type Layer1Output } from "@/lib/image-forensics/types";
import { forensicFetch } from "@/lib/api-client";

export async function analyzeImageFile(file: File): Promise<Layer1Output> {
  return forensicFetch(
    "/api/image-forensics",
    file,
    isLayer1Output,
    "Image analysis failed"
  );
}
