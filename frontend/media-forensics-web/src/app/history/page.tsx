"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableColumn, 
  TableRow, 
  TableCell, 
  Chip, 
  Spinner,
  Card,
  Button
} from "@heroui/react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteFooter, TopNav } from "@/components/chrome";

interface HistoryRecord {
  id: number;
  request_id: string;
  media_type: string;
  verdict: string;
  confidence: number;
  timestamp: string;
  source?: "backend" | "local";
}

interface HistoryResponse {
  records: HistoryRecord[];
  sources?: {
    backend: boolean;
    local: boolean;
  };
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video" | "audio">("all");
  const [sourceStatus, setSourceStatus] = useState<{ backend: boolean; local: boolean }>({
    backend: false,
    local: false,
  });

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/history?limit=50");
      if (!response.ok) throw new Error("Failed to load history");
      const data = (await response.json()) as HistoryResponse;
      setRecords(data.records || []);
      setSourceStatus({
        backend: Boolean(data.sources?.backend),
        local: Boolean(data.sources?.local),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getVerdictLabel = (verdict: string) => {
    return verdict.toUpperCase();
  };

  const getVerdictColor = (verdict: string) => {
    const v = verdict.toLowerCase();
    if (v.includes("fake") || v.includes("ai")) return "danger";
    if (v.includes("real")) return "success";
    return "warning";
  };

  const mediaColor: Record<string, string> = {
    image: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    video: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    audio: "bg-orange-500/20 text-orange-300 border-orange-500/30"
  };

  const visibleRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return records.filter((record) => {
      if (mediaFilter !== "all" && record.media_type !== mediaFilter) return false;
      if (!normalizedQuery) return true;

      return [record.request_id, record.verdict, record.media_type]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [mediaFilter, records, searchQuery]);

  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="history" />

      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
        <div className="relative min-h-screen pt-0 overflow-hidden bg-black text-white">
          {/* Background elements to match overall theme */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute top-[20%] -right-[5%] w-[35%] h-[35%] rounded-full bg-purple-600/20 blur-[120px]" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <ScrollReveal>
              <div className="mb-10 text-center">
                <h1 className="mb-6 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
                  Analysis History Dashboard
                </h1>
                <p className="text-white/60 text-lg max-w-2xl mx-auto">
                  Track and review past forensic detections across all media types.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="liquid-glass p-4 text-center">
                  <p className="text-white/50 text-xs">Total Analyses</p>
                  <p className="text-2xl italic text-white">{visibleRecords.length}</p>
                </Card>

                <Card className="liquid-glass p-4 text-center">
                  <p className="text-white/50 text-xs">AI Detected</p>
                  <p className="text-2xl text-danger">
                    {visibleRecords.filter(r => r.verdict.toLowerCase().includes("fake") || r.verdict.toLowerCase().includes("ai")).length}
                  </p>
                </Card>

                <Card className="liquid-glass p-4 text-center">
                  <p className="text-white/50 text-xs">Authentic</p>
                  <p className="text-2xl text-success">
                    {visibleRecords.filter(r => r.verdict.toLowerCase().includes("real")).length}
                  </p>
                </Card>

                <Card className="liquid-glass p-4 text-center">
                  <p className="text-white/50 text-xs">Avg Confidence</p>
                  <p className="text-2xl text-white">
                    {visibleRecords.length
                      ? (visibleRecords.reduce((a, b) => a + b.confidence, 0) / visibleRecords.length * 100).toFixed(1) + "%"
                      : "-"}
                  </p>
                </Card>
              </div>

              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search request ID, verdict, or media"
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <select
                    value={mediaFilter}
                    onChange={(event) => setMediaFilter(event.target.value as "all" | "image" | "video" | "audio")}
                    className="rounded-full border border-white/15 bg-black px-4 py-2 text-sm text-white outline-none"
                  >
                    <option value="all">All media</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {sourceStatus.backend ? (
                    <Chip size="sm" variant="secondary" className="border-success/20 bg-success/10 text-success">
                      Backend history live
                    </Chip>
                  ) : null}
                  {sourceStatus.local ? (
                    <Chip size="sm" variant="secondary" className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                      Local fallback loaded
                    </Chip>
                  ) : null}
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="bg-white/10 text-white border-white/20"
                    onPress={fetchHistory}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              <Card className="liquid-glass border-white/10 p-6">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-20">
                    <Spinner color="accent" />
                    <span className="text-white/60 text-sm">Loading records...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-20">
                    <p className="text-danger mb-4">{error}</p>
                    <Button variant="secondary" className="bg-white/10 text-white border-white/20" onPress={fetchHistory}>
                      Retry
                    </Button>
                  </div>
                ) : visibleRecords.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-white/40">No matching analysis records.</p>
                    <p className="text-xs text-white/30 mt-2">
                      Adjust the filters or run a new forensic analysis to populate history.
                    </p>
                  </div>
                ) : (
                  <Table 
                    aria-label="Analysis History Table"
                    className="bg-transparent max-h-[70vh] overflow-scroll"
                  >
                    <TableHeader>
                      <TableColumn>DATE & TIME</TableColumn>
                      <TableColumn>MEDIA TYPE</TableColumn>
                      <TableColumn>REQUEST ID</TableColumn>
                      <TableColumn>VERDICT</TableColumn>
                      <TableColumn>CONFIDENCE</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {visibleRecords.map((record) => (
                        <TableRow key={record.id} className="cursor-pointer hover:bg-white/5 transition">
                          <TableCell>
                            {new Date(record.timestamp).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="secondary" className={`capitalize ${mediaColor[record.media_type] || "bg-white/10 text-white border-white/20"}`}>
                              {record.media_type}
                            </Chip>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-white/50">
                            <div>{record.request_id}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/30">
                              {record.source || "unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              size="sm" 
                              variant="secondary"
                              className={`font-bold ${
                                getVerdictColor(record.verdict) === "success" 
                                  ? "bg-success/20 text-success border-success/30" 
                                  : getVerdictColor(record.verdict) === "danger"
                                  ? "bg-danger/20 text-danger border-danger/30"
                                  : "bg-warning/20 text-warning border-warning/30"
                              }`}
                            >
                              {getVerdictLabel(record.verdict)}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className={record.confidence > 0.8 ? "text-success font-semibold" : ""}>
                              {(record.confidence * 100).toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
