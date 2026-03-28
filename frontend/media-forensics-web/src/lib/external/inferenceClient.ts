import { isAllowedMediaFile } from "@/lib/analysis/media";
import type { MediaType, NormalizedResult } from "@/lib/analysis/types";
import { normalizeExternalResult } from "@/lib/mappers/normalizeResult";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const KNOWN_MEDIA_PATHS = ["/image", "/audio", "/video"] as const;

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
  };
}

function getExternalConfiguration() {
  const endpoint = process.env.EXTERNAL_INFERENCE_URL?.trim();
  const token = process.env.EXTERNAL_INFERENCE_KEY?.trim();

  if (!endpoint || !token) {
    throw new Error("External inference is not configured");
  }

  return { endpoint, token };
}

function getExternalTimeoutMs(): number | null {
  const rawValue = process.env.EXTERNAL_INFERENCE_TIMEOUT_MS?.trim();

  if (!rawValue) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  if (parsedValue === 0) {
    return null;
  }

  return parsedValue;
}

function getExternalEndpoint(baseEndpoint: string, mediaType: MediaType): string {
  const normalizedBase = baseEndpoint.replace(/\/+$/, "");

  for (const knownPath of KNOWN_MEDIA_PATHS) {
    if (normalizedBase.endsWith(knownPath)) {
      return `${normalizedBase.slice(0, -knownPath.length)}/${mediaType}`;
    }
  }

  return `${normalizedBase}/${mediaType}`;
}

async function parseExternalResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export async function runExternalInference(file: File, mediaType: MediaType): Promise<NormalizedResult> {
  if (!isAllowedMediaFile(mediaType, file)) {
    throw new Error("Unsupported file type for external analysis");
  }

  const { endpoint, token } = getExternalConfiguration();
  const resolvedEndpoint = getExternalEndpoint(endpoint, mediaType);
  const formData = new FormData();
  formData.append("file", file, file.name || "uploaded_media");
  const timeoutMs = getExternalTimeoutMs();
  const timeout = timeoutMs !== null ? createTimeoutSignal(timeoutMs) : null;

  try {
    let response: Response;

    try {
      response = await fetch(resolvedEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        cache: "no-store",
        signal: timeout?.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("External inference request timed out");
      }

      throw error;
    }

    const payload = await parseExternalResponse(response);
    if (!response.ok) {
      throw new Error(`External inference request failed (${response.status})`);
    }

    return normalizeExternalResult(payload);
  } finally {
    timeout?.cancel();
  }
}
