export interface HistoryPersistenceInput {
  media_type: "image" | "audio" | "video";
  verdict: string;
  confidence: number;
  request_id?: string;
  timestamp?: string;
  result?: unknown;
}

export function createClientReportId(mediaType: string): string {
  const prefix = mediaType.slice(0, 3).toLowerCase() || "med";
  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}_${token}`;
}

export async function persistHistoryEntry(entry: HistoryPersistenceInput): Promise<void> {
  await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...entry,
      request_id: entry.request_id || createClientReportId(entry.media_type),
      timestamp: entry.timestamp || new Date().toISOString(),
    }),
  });
}
