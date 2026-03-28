import { createAnalysisHealthResponse, handleAnalyzeRequest } from "@/lib/server/forensics-route";

export async function GET(request: Request) {
  const mediaType = new URL(request.url).searchParams.get("mediaType");

  if (mediaType === "image" || mediaType === "audio" || mediaType === "video") {
    return createAnalysisHealthResponse(mediaType);
  }

  return createAnalysisHealthResponse();
}

export async function POST(request: Request) {
  return handleAnalyzeRequest({ request });
}
