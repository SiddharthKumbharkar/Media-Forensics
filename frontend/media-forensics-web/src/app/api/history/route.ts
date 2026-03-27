import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8001";
const LOCALHOST_BACKEND_BASE_URL = "http://localhost:8001";
const HISTORY_FILE = path.resolve(process.cwd(), "src", "data", "history.json");
const MAX_HISTORY_RECORDS = 1000;

type HistorySource = "backend" | "local";

interface HistoryRecord {
  id: number;
  request_id: string;
  media_type: string;
  verdict: string;
  confidence: number;
  timestamp: string;
  raw?: unknown;
  source?: HistorySource;
}

interface HistoryStore {
  records: HistoryRecord[];
}

interface HistoryResultPayload {
  verdict?: string;
  authenticity_score?: number;
}

interface HistoryPostPayload {
  request_id?: string;
  media_type?: string;
  verdict?: string;
  confidence?: number;
  timestamp?: string;
  result?: HistoryResultPayload;
}

function getBackendUrls(): string[] {
  const values = [process.env.VIDEO_FORENSICS_API_BASE_URL, DEFAULT_BACKEND_BASE_URL, LOCALHOST_BACKEND_BASE_URL];
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

function ensureHistoryDir() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ records: [] }, null, 2), "utf8");
  }
}

function readHistory(): HistoryStore {
  try {
    ensureHistoryDir();
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(raw) as HistoryStore;
  } catch {
    return { records: [] };
  }
}

function writeHistory(data: HistoryStore) {
  ensureHistoryDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf8");
}

function parseNumberParam(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

function normalizeRecord(record: Partial<HistoryRecord>, source: HistorySource): HistoryRecord | null {
  if (!record.request_id || !record.media_type || !record.verdict || !record.timestamp) return null;

  const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence) ? record.confidence : 0;

  return {
    id: typeof record.id === "number" ? record.id : Date.now(),
    request_id: record.request_id,
    media_type: record.media_type,
    verdict: record.verdict,
    confidence,
    timestamp: record.timestamp,
    raw: record.raw,
    source,
  };
}

async function fetchBackendHistory(limit: number, mediaType: string | null): Promise<HistoryRecord[]> {
  for (const baseUrl of getBackendUrls()) {
    try {
      const backendUrl = new URL(`${baseUrl}/history`);
      backendUrl.searchParams.set("limit", String(limit));
      backendUrl.searchParams.set("offset", "0");
      if (mediaType) backendUrl.searchParams.set("media_type", mediaType);

      const response = await fetch(backendUrl, { cache: "no-store" });
      if (!response.ok) continue;

      const data = (await response.json()) as { records?: Partial<HistoryRecord>[] };
      return (data.records || [])
        .map((record) => normalizeRecord(record, "backend"))
        .filter((record): record is HistoryRecord => Boolean(record));
    } catch {
      // Fall through to the local history store if backend history is unavailable.
    }
  }

  return [];
}

function mergeHistoryRecords(records: HistoryRecord[]): HistoryRecord[] {
  const merged = new Map<string, HistoryRecord>();

  for (const record of records) {
    const key = record.request_id || `${record.media_type}:${record.timestamp}:${record.verdict}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, record);
      continue;
    }

    if (existing.source === "local" && record.source === "backend") {
      merged.set(key, { ...existing, ...record, raw: existing.raw ?? record.raw });
    }
  }

  return [...merged.values()].sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    return rightTime - leftTime;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseNumberParam(searchParams.get("limit"), 50, 500);
  const offset = parseNumberParam(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);
  const mediaType = searchParams.get("media_type");

  const backendRecords = await fetchBackendHistory(limit + offset, mediaType);
  const localRecords = readHistory().records
    .map((record) => normalizeRecord(record, "local"))
    .filter((record): record is HistoryRecord => Boolean(record));

  const mergedRecords = mergeHistoryRecords([...backendRecords, ...localRecords]);
  const filteredRecords = mediaType
    ? mergedRecords.filter((record) => record.media_type === mediaType)
    : mergedRecords;
  const pagedRecords = filteredRecords.slice(offset, offset + limit);

  return NextResponse.json(
    {
      records: pagedRecords,
      total: filteredRecords.length,
      limit,
      offset,
      sources: {
        backend: backendRecords.length > 0,
        local: localRecords.length > 0,
      },
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as HistoryPostPayload;
    const now = new Date().toISOString();

    const entry = normalizeRecord(
      {
        id: Date.now(),
        request_id: payload.request_id || `req_${Math.random().toString(36).slice(2, 9)}`,
        media_type: payload.media_type || "unknown",
        verdict: payload.verdict || payload.result?.verdict || "unknown",
        confidence:
          typeof payload.confidence === "number"
            ? payload.confidence
            : Number(payload.result?.authenticity_score ?? 0),
        timestamp: payload.timestamp || now,
        raw: payload,
      },
      "local",
    );

    if (!entry) {
      return NextResponse.json({ ok: false, error: "Invalid history payload" }, { status: 400 });
    }

    const data = readHistory();
    data.records = mergeHistoryRecords([entry, ...data.records.map((record) => ({ ...record, source: "local" as const }))])
      .map((record) => ({
        id: record.id,
        request_id: record.request_id,
        media_type: record.media_type,
        verdict: record.verdict,
        confidence: record.confidence,
        timestamp: record.timestamp,
        raw: record.raw,
      }))
      .slice(0, MAX_HISTORY_RECORDS);
    writeHistory(data);

    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
