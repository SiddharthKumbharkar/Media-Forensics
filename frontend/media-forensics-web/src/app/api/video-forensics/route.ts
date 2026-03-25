import { NextResponse } from "next/server";
import { isVideoForensicsResult } from "@/lib/video-forensics/types";

const DEFAULT_DEEPSAFE_BASE_URL = "http://127.0.0.1:8001";
const LOCALHOST_DEEPSAFE_BASE_URL = "http://localhost:8001";
const LEGACY_DEEPSAFE_BASE_URL = "http://127.0.0.1:8000";
const LEGACY_LOCALHOST_DEEPSAFE_BASE_URL = "http://localhost:8000";

const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".avi", ".mkv"]);

function getBackendUrls(): string[] {
  const fromEnv =
    process.env.VIDEO_FORENSICS_API_BASE_URL?.trim() ||
    process.env.DEEPSAFE_API_BASE_URL?.trim() ||
    process.env.LAYER1_API_BASE_URL?.trim();

  const values = [
    fromEnv,
    DEFAULT_DEEPSAFE_BASE_URL,
    LOCALHOST_DEEPSAFE_BASE_URL,
    LEGACY_DEEPSAFE_BASE_URL,
    LEGACY_LOCALHOST_DEEPSAFE_BASE_URL,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(values)];
}

function getFileExtension(filename: string | undefined): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function isAllowedVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return ALLOWED_VIDEO_EXTENSIONS.has(getFileExtension(file.name));
}

async function parseBackendError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string; message?: string };
    return payload.detail || payload.message || `Video backend request failed (${response.status})`;
  } catch {
    return `Video backend request failed (${response.status})`;
  }
}

function backendUnavailableMessage(urls: string[]): string {
  return [
    "Video backend is unreachable.",
    `Tried: ${urls.join(", ")}`,
    "Start DeepSafe API and expose /detect and /health endpoints, or set VIDEO_FORENSICS_API_BASE_URL.",
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

  if (!isAllowedVideoFile(fileField)) {
    return NextResponse.json({ message: "Unsupported video format" }, { status: 400 });
  }

  const backendUrls = getBackendUrls();
  let networkFailureCount = 0;

  for (const baseUrl of backendUrls) {
    const relayFormData = new FormData();
    relayFormData.append("file", fileField, fileField.name || "uploaded_video");

    try {
      const response = await fetch(`${baseUrl}/detect`, {
        method: "POST",
        body: relayFormData,
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json({ message: await parseBackendError(response) }, { status: response.status });
      }

      const payload: unknown = await response.json();
      if (!isVideoForensicsResult(payload)) {
        return NextResponse.json({ message: "Video backend response schema mismatch" }, { status: 502 });
      }

      return NextResponse.json(payload, { status: 200 });
    } catch {
      networkFailureCount += 1;
    }
  }

  if (networkFailureCount === backendUrls.length) {
    return NextResponse.json({ message: backendUnavailableMessage(backendUrls) }, { status: 503 });
  }

  return NextResponse.json({ message: "Video analysis request failed" }, { status: 502 });
}
