import { createAnalysisHealthResponse, handleAnalyzeRequest } from "@/lib/server/forensics-route";

export async function GET() {
  return createAnalysisHealthResponse("audio");
}

export async function POST(request: Request) {
  return handleAnalyzeRequest({ request, mediaType: "audio" });
}
