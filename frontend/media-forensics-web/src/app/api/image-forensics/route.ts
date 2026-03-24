import { NextResponse } from "next/server";
import { isLayer1Output } from "@/lib/image-forensics/types";

const DEFAULT_LAYER1_BASE_URL = "http://127.0.0.1:8000";
const LOCALHOST_LAYER1_BASE_URL = "http://localhost:8000";

function getLayer1Urls(): string[] {
  const fromEnv = process.env.LAYER1_API_BASE_URL?.trim();
  const values = [fromEnv, DEFAULT_LAYER1_BASE_URL, LOCALHOST_LAYER1_BASE_URL].filter(
    (value): value is string => Boolean(value),
  );

  return [...new Set(values)];
}

async function parseBackendError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail || `Layer1 request failed (${response.status})`;
  } catch {
    return `Layer1 request failed (${response.status})`;
  }
}

function backendUnavailableMessage(urls: string[]): string {
  return [
    "Layer1 backend is unreachable.",
    `Tried: ${urls.join(", ")}`,
    "Start the backend with:",
    "python3 -m uvicorn main:app --app-dir /Users/sriram_kommalapudi/Projects/Media-Forensics/layer1backend --host 127.0.0.1 --port 8000",
    "Or set LAYER1_API_BASE_URL to your running backend URL.",
  ].join(" ");
}

export async function GET() {
  const urls = getLayer1Urls();

  for (const baseUrl of urls) {
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, {
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
      message: backendUnavailableMessage(urls),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const incoming = await request.formData();
  const fileField = incoming.get("file");

  if (!(fileField instanceof File)) {
    return NextResponse.json({ message: "File field is required" }, { status: 400 });
  }

  if (!fileField.type.startsWith("image/")) {
    return NextResponse.json({ message: "Uploaded file must be an image" }, { status: 400 });
  }

  const startedAt = performance.now();
  const layer1Urls = getLayer1Urls();
  let networkFailureCount = 0;

  for (const baseUrl of layer1Urls) {
    const relayFormData = new FormData();
    relayFormData.append("file", fileField, fileField.name);

    try {
      const response = await fetch(`${baseUrl}/analyze/image`, {
        method: "POST",
        body: relayFormData,
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json({ message: await parseBackendError(response) }, { status: response.status });
      }

      const payload: unknown = await response.json();
      if (!isLayer1Output(payload)) {
        return NextResponse.json({ message: "Layer1 response schema mismatch" }, { status: 502 });
      }

      const elapsedMs = Math.round(performance.now() - startedAt);

      return NextResponse.json(
        {
          ...payload,
          processing_ms: elapsedMs,
        },
        {
          status: 200,
        },
      );
    } catch {
      networkFailureCount += 1;
    }
  }

  if (networkFailureCount === layer1Urls.length) {
    return NextResponse.json({ message: backendUnavailableMessage(layer1Urls) }, { status: 503 });
  }

  return NextResponse.json({ message: "Layer1 request failed" }, { status: 502 });
}
