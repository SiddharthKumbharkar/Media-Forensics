import { isVideoForensicsResult, type VideoForensicsResult } from "@/lib/video-forensics/types";

interface ErrorPayload {
  detail?: string;
  message?: string;
  error?: string;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return payload.detail || payload.message || payload.error || "Video analysis failed";
  } catch {
    return `Video analysis failed (${response.status})`;
  }
}

export async function analyzeVideoFile(file: File): Promise<VideoForensicsResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/video-forensics", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const payload: unknown = await response.json();
  if (!isVideoForensicsResult(payload)) {
    throw new Error("Unexpected backend response format for video analysis");
  }

  return payload;
}
