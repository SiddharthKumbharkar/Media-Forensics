import { NextResponse } from "next/server";
import { isAudioForensicsResult } from "@/lib/audio-forensics/types";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";
const LOCALHOST_BACKEND_BASE_URL = "http://localhost:8000";

const ALLOWED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".mp4", ".mov", ".avi", ".mkv", ".webm"]);

function getBackendUrls(): string[] {
  const fromEnv = process.env.AUDIO_FORENSICS_API_BASE_URL?.trim() || process.env.LAYER1_API_BASE_URL?.trim();
  const values = [fromEnv, DEFAULT_BACKEND_BASE_URL, LOCALHOST_BACKEND_BASE_URL].filter(
    (value): value is string => Boolean(value),
  );

  return [...new Set(values)];
}

function getFileExtension(filename: string | undefined): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function isAllowedAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return ALLOWED_AUDIO_EXTENSIONS.has(getFileExtension(file.name));
}

async function parseBackendError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string; message?: string };
    return payload.detail || payload.message || `Audio backend request failed (${response.status})`;
  } catch {
    return `Audio backend request failed (${response.status})`;
  }
}

function backendUnavailableMessage(urls: string[]): string {
  return [
    "Audio backend is unreachable.",
    `Tried: ${urls.join(", ")}`,
    "Start backend with:",
    "python3 -m uvicorn main:app --app-dir /Users/sriram_kommalapudi/Projects/Media-Forensics/layer1backend --host 127.0.0.1 --port 8000",
    "Or set AUDIO_FORENSICS_API_BASE_URL to your backend URL.",
  ].join(" ");
}

export async function GET() {
  const urls = getBackendUrls();

  for (const baseUrl of urls) {
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, { method: "GET", cache: "no-store" });
      if (healthResponse.ok) {
        return NextResponse.json({ status: "ok", backend_reachable: true, backend_url: baseUrl }, { status: 200 });
      }
    } catch {
      // try next URL
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

  if (!isAllowedAudioFile(fileField)) {
    return NextResponse.json({ message: "Unsupported audio format" }, { status: 400 });
  }

  const startedAt = performance.now();
  const backendUrls = getBackendUrls();
  let networkFailureCount = 0;

  for (const baseUrl of backendUrls) {
    const relayFormData = new FormData();
    relayFormData.append("file", fileField, fileField.name || "uploaded_audio");

    try {
      const response = await fetch(`${baseUrl}/analyze/audio`, {
        method: "POST",
        body: relayFormData,
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json({ message: await parseBackendError(response) }, { status: response.status });
      }

      const payload: unknown = await response.json();
      if (!isAudioForensicsResult(payload)) {
        return NextResponse.json({ message: "Audio backend response schema mismatch" }, { status: 502 });
      }

      const elapsedMs = Math.round(performance.now() - startedAt);
      return NextResponse.json({ ...payload, processing_ms: elapsedMs }, { status: 200 });
    } catch {
      networkFailureCount += 1;
    }
  }

  if (networkFailureCount === backendUrls.length) {
    return NextResponse.json({ message: backendUnavailableMessage(backendUrls) }, { status: 503 });
  }

  return NextResponse.json({ message: "Audio analysis request failed" }, { status: 502 });
}
