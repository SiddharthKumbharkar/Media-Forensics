import { NextResponse } from "next/server";

export type BackendValidator<T> = (value: unknown) => value is T;

interface HealthRouteConfig {
  backendUrls: string[];
  healthPath?: string;
  unavailableMessage: string;
}

interface UploadRouteConfig<T> {
  request: Request;
  backendUrls: string[];
  analyzePath: string;
  unavailableMessage: string;
  validator: BackendValidator<T>;
  validateFile: (file: File) => string | null;
  parseBackendError: (response: Response) => Promise<string>;
  mapPayload?: (payload: T, elapsedMs: number) => unknown;
}

export function getCandidateUrls(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

export async function createBackendHealthResponse({
  backendUrls,
  healthPath = "/health",
  unavailableMessage,
}: HealthRouteConfig) {
  for (const baseUrl of backendUrls) {
    try {
      const healthResponse = await fetch(`${baseUrl}${healthPath}`, {
        method: "GET",
        cache: "no-store",
      });

      if (healthResponse.ok) {
        return NextResponse.json(
          {
            status: "ok",
            backend_reachable: true,
            backend_url: baseUrl,
          },
          { status: 200 },
        );
      }
    } catch {
      // Try the next candidate URL.
    }
  }

  return NextResponse.json(
    {
      status: "degraded",
      backend_reachable: false,
      message: unavailableMessage,
    },
    { status: 200 },
  );
}

export async function relayMultipartUpload<T>({
  request,
  backendUrls,
  analyzePath,
  unavailableMessage,
  validator,
  validateFile,
  parseBackendError,
  mapPayload,
}: UploadRouteConfig<T>) {
  const incoming = await request.formData();
  const fileField = incoming.get("file");

  if (!(fileField instanceof File)) {
    return NextResponse.json({ message: "File field is required" }, { status: 400 });
  }

  const validationError = validateFile(fileField);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const startedAt = performance.now();
  let networkFailureCount = 0;

  for (const baseUrl of backendUrls) {
    const relayFormData = new FormData();
    relayFormData.append("file", fileField, fileField.name || "uploaded_media");

    try {
      const response = await fetch(`${baseUrl}${analyzePath}`, {
        method: "POST",
        body: relayFormData,
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json({ message: await parseBackendError(response) }, { status: response.status });
      }

      const payload: unknown = await response.json();
      if (!validator(payload)) {
        return NextResponse.json({ message: "Backend response schema mismatch" }, { status: 502 });
      }

      const elapsedMs = Math.round(performance.now() - startedAt);
      return NextResponse.json(mapPayload ? mapPayload(payload, elapsedMs) : payload, { status: 200 });
    } catch {
      networkFailureCount += 1;
    }
  }

  if (networkFailureCount === backendUrls.length) {
    return NextResponse.json({ message: unavailableMessage }, { status: 503 });
  }

  return NextResponse.json({ message: "Backend request failed" }, { status: 502 });
}
