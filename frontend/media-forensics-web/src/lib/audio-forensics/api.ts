import { isAudioForensicsResult, type AudioForensicsResult } from "@/lib/audio-forensics/types";

interface ErrorPayload {
  detail?: string;
  message?: string;
  error?: string;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return payload.detail || payload.message || payload.error || "Audio analysis failed";
  } catch {
    return `Audio analysis failed (${response.status})`;
  }
}

export async function analyzeAudioFile(file: File): Promise<AudioForensicsResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/audio-forensics", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const payload: unknown = await response.json();
  if (!isAudioForensicsResult(payload)) {
    throw new Error("Unexpected backend response format for audio analysis");
  }

  return payload;
}
