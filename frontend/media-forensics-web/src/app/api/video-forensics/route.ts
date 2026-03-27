import { isVideoForensicsResult } from "@/lib/video-forensics/types";
import {
  createBackendHealthResponse,
  getCandidateUrls,
  relayMultipartUpload,
} from "@/lib/server/forensics-route";

const DEFAULT_DEEPSAFE_BASE_URL = "http://127.0.0.1:8001";
const LOCALHOST_DEEPSAFE_BASE_URL = "http://localhost:8001";

const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".avi", ".mkv"]);

function getBackendUrls(): string[] {
  return getCandidateUrls([
    process.env.VIDEO_FORENSICS_API_BASE_URL || process.env.DEEPSAFE_API_BASE_URL,
    DEFAULT_DEEPSAFE_BASE_URL,
    LOCALHOST_DEEPSAFE_BASE_URL,
  ]);
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
    analyzePath: "/detect",
    unavailableMessage: backendUnavailableMessage(backendUrls),
    validator: isVideoForensicsResult,
    validateFile: (file) => (isAllowedVideoFile(file) ? null : "Unsupported video format"),
    parseBackendError,
  });
}
