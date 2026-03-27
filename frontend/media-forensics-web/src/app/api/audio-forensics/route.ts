import { isAudioForensicsResult } from "@/lib/audio-forensics/types";
import {
  createBackendHealthResponse,
  getCandidateUrls,
  relayMultipartUpload,
} from "@/lib/server/forensics-route";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";
const LOCALHOST_BACKEND_BASE_URL = "http://localhost:8000";

const ALLOWED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".mp4", ".mov", ".avi", ".mkv", ".webm"]);

function getBackendUrls(): string[] {
  return getCandidateUrls([
    process.env.AUDIO_FORENSICS_API_BASE_URL || process.env.LAYER1_API_BASE_URL,
    DEFAULT_BACKEND_BASE_URL,
    LOCALHOST_BACKEND_BASE_URL,
  ]);
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
  return createBackendHealthResponse({
    backendUrls: urls,
    unavailableMessage: backendUnavailableMessage(urls),
  });
}

export async function POST(request: Request) {
  const backendUrls = getBackendUrls();

  return relayMultipartUpload({
    request,
    backendUrls,
    analyzePath: "/analyze/audio",
    unavailableMessage: backendUnavailableMessage(backendUrls),
    validator: isAudioForensicsResult,
    validateFile: (file) => (isAllowedAudioFile(file) ? null : "Unsupported audio format"),
    parseBackendError,
    mapPayload: (payload, elapsedMs) => ({ ...payload, processing_ms: elapsedMs }),
  });
}
