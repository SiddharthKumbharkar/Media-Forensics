import { isLayer1Output } from "@/lib/image-forensics/types";
import {
  createBackendHealthResponse,
  getCandidateUrls,
  relayMultipartUpload,
} from "@/lib/server/forensics-route";

const DEFAULT_LAYER1_BASE_URL = "http://127.0.0.1:8000";
const LOCALHOST_LAYER1_BASE_URL = "http://localhost:8000";

function getLayer1Urls(): string[] {
  return getCandidateUrls([process.env.LAYER1_API_BASE_URL, DEFAULT_LAYER1_BASE_URL, LOCALHOST_LAYER1_BASE_URL]);
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
  return createBackendHealthResponse({
    backendUrls: urls,
    unavailableMessage: backendUnavailableMessage(urls),
  });
}

export async function POST(request: Request) {
  const layer1Urls = getLayer1Urls();

  return relayMultipartUpload({
    request,
    backendUrls: layer1Urls,
    analyzePath: "/analyze/image",
    unavailableMessage: backendUnavailableMessage(layer1Urls),
    validator: isLayer1Output,
    validateFile: (file) => (file.type.startsWith("image/") ? null : "Uploaded file must be an image"),
    parseBackendError,
    mapPayload: (payload, elapsedMs) => ({
      ...payload,
      processing_ms: elapsedMs,
    }),
  });
}
