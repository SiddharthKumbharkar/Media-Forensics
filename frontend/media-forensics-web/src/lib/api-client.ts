"use client";

import type { MediaType } from "@/lib/analysis/types";

interface ErrorPayload {
  detail?: string;
  message?: string;
  error?: string;
}

async function extractErrorMessage(response: Response, defaultMessage: string): Promise<string> {
  try {
    const json = (await response.json()) as ErrorPayload;
    return json.detail || json.message || json.error || defaultMessage;
  } catch {
    return `${defaultMessage} (${response.status})`;
  }
}

export async function forensicFetch<T>(
  url: string, 
  file: File, 
  validator: (data: unknown) => data is T,
  defaultError: string,
  mediaType?: MediaType,
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  if (mediaType) {
    formData.append("mediaType", mediaType);
  }

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, defaultError));
  }

  const payload: unknown = await response.json();
  if (!validator(payload)) {
    throw new Error("Unexpected analysis response format");
  }

  return payload;
}
