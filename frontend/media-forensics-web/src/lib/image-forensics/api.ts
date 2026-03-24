import { isLayer1Output, type Layer1Output } from "@/lib/image-forensics/types";

interface ErrorPayload {
  detail?: string;
  message?: string;
  error?: string;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as ErrorPayload;
    return json.detail || json.message || json.error || "Image analysis failed";
  } catch {
    return `Image analysis failed (${response.status})`;
  }
}

export async function analyzeImageFile(file: File): Promise<Layer1Output> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/image-forensics", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const payload: unknown = await response.json();
  if (!isLayer1Output(payload)) {
    throw new Error("Unexpected backend response format");
  }

  return payload;
}
