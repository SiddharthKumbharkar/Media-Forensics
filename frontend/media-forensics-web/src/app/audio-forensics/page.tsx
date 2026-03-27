"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button, Card, Chip, ProgressBar, Spinner } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";
import { analyzeAudioFile } from "@/lib/audio-forensics/api";
import { createClientReportId, persistHistoryEntry } from "@/lib/history-client";
import { useLoadingMessages } from "@/hooks/use-loading-messages";
import { formatFixed, getVerdictView, toPercent, type Tone } from "@/lib/audio-forensics/presentation";
import type { AudioForensicsResult } from "@/lib/audio-forensics/types";

const DEFAULT_WAVE_HEIGHTS = [8, 14, 26, 18, 34, 22, 40, 34, 42, 30, 38, 22, 26, 14, 10, 18, 32, 24, 36, 28, 34, 20];
const SUPPORTED_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".mp4", ".mov", ".avi", ".mkv", ".webm"]);
const AUDIO_LOADING_MESSAGES = [
  "Loading waveform and speech segments...",
  "Checking ENF consistency...",
  "Analyzing prosody and glottal signatures...",
  "Inspecting room-acoustic transitions...",
  "Compiling audio forensics report...",
];

interface TimelineEvent {
  id: string;
  kind: "splice" | "anomaly" | "flag";
  label: string;
  sec: number;
}

interface SignalCard {
  title: string;
  status: string;
  detail: string;
  score: number;
  confidence: number;
  color: Tone;
}

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.max(0, Math.floor(totalSeconds % 60));

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function isSupportedAudio(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return SUPPORTED_AUDIO_EXTENSIONS.has(getExtension(file.name));
}

function clampPercent(score: number | null | undefined): number {
  if (typeof score !== "number") return 0;
  return toPercent(score);
}

function toneFromScore(score: number): Tone {
  if (score >= 0.7) return "success";
  if (score >= 0.45) return "warning";
  return "danger";
}

function formatLatency(result: AudioForensicsResult | null): string {
  if (!result) return "-";
  if (typeof result.processing_time_sec === "number" && result.processing_time_sec > 0) {
    return `${result.processing_time_sec.toFixed(2)}s`;
  }
  if (typeof result.processing_ms === "number" && result.processing_ms > 0) {
    return `${(result.processing_ms / 1000).toFixed(2)}s`;
  }
  return "-";
}

async function buildWaveformFromFile(file: File, bars = 60): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new window.AudioContext();

  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / bars));
    const points: number[] = [];

    for (let i = 0; i < bars; i += 1) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channelData.length);
      let max = 0;

      for (let j = start; j < end; j += 1) {
        const value = Math.abs(channelData[j]);
        if (value > max) max = value;
      }

      points.push(Math.round(6 + max * 44));
    }

    return points;
  } finally {
    await audioContext.close();
  }
}

export default function AudioForensicsPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [reportId, setReportId] = useState<string>("");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [waveHeights, setWaveHeights] = useState<number[]>(DEFAULT_WAVE_HEIGHTS);
  const [result, setResult] = useState<AudioForensicsResult | null>(null);
  const loadingMessage = useLoadingMessages(isLoading, AUDIO_LOADING_MESSAGES);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const analysisDurationSec = Math.max(1, result?.file_duration_sec || audioDurationSec || 1);
  const authenticityPercent = result ? toPercent(result.authenticity_score) : 0;
  const aiLikelihoodPercent = result ? Math.max(0, 100 - authenticityPercent) : 0;
  const confidencePercent = result ? toPercent(result.overall_confidence) : 0;
  const verdict = result ? getVerdictView(result.final_verdict) : null;

  const timelineEvents = useMemo(() => {
    if (!result) return [] as TimelineEvent[];

    const splices = (result.enf_analysis.splice_locations_sec || []).map((sec, idx) => ({
      id: `splice-${idx}`,
      kind: "splice" as const,
      label: `Splice detected @ ${formatTime(sec)}`,
      sec,
    }));

    const anomalies = result.all_anomalies.map((item, idx) => ({
      id: `anomaly-${idx}`,
      kind: "anomaly" as const,
      label: item,
      sec: Math.min(analysisDurationSec - 0.1, ((idx + 1) * analysisDurationSec) / (result.all_anomalies.length + 1)),
    }));

    const flags = result.all_flags.map((item, idx) => ({
      id: `flag-${idx}`,
      kind: "flag" as const,
      label: item,
      sec: Math.min(analysisDurationSec - 0.1, ((idx + 1) * analysisDurationSec) / (result.all_flags.length + 1)),
    }));

    return [...splices, ...anomalies, ...flags].sort((a, b) => a.sec - b.sec);
  }, [result, analysisDurationSec]);

  const signalCards: SignalCard[] = useMemo(() => {
    if (!result) {
      return [
        { title: "Prosodic Consistency", status: "Pending", detail: "Awaiting analysis", score: 0, confidence: 0, color: "warning" },
        { title: "ENF Match", status: "Pending", detail: "Awaiting analysis", score: 0, confidence: 0, color: "warning" },
        { title: "Background Noise", status: "Pending", detail: "Awaiting analysis", score: 0, confidence: 0, color: "warning" },
        { title: "Temporal Artifacts", status: "Pending", detail: "Awaiting analysis", score: 0, confidence: 0, color: "warning" },
      ];
    }

    const prosodyScore = result.layer_scores.prosody_score ?? result.prosodic_analysis.prosody_naturalness_score;
    const prosodyStatus = prosodyScore >= 0.7 ? "Natural" : "Irregular";

    const enfScore = result.layer_scores.enf_score ?? result.enf_analysis.enf_consistency_score;
    const enfMatched = result.enf_analysis.enf_present && enfScore >= 0.65;

    const roomScore = result.layer_scores.room_acoustic_score ?? result.room_acoustic_analysis.room_consistency_score;
    const roomStatus = roomScore >= 0.7 ? "Consistent" : "Synthetic/Shifted";

    const hasTemporalArtifacts = result.enf_analysis.splice_detected || result.room_acoustic_analysis.splice_suspected;
    const temporalScore = hasTemporalArtifacts ? 0.2 : 0.9;

    return [
      {
        title: "Prosodic Consistency",
        status: prosodyStatus,
        detail: `Jitter ${formatFixed(result.prosodic_analysis.jitter_local_percent, 2)}% · Rhythm CV ${formatFixed(result.prosodic_analysis.syllable_interval_cv, 2)}`,
        score: clampPercent(prosodyScore),
        confidence: toPercent(result.prosodic_analysis.confidence),
        color: toneFromScore(prosodyScore),
      },
      {
        title: "ENF Match",
        status: enfMatched ? "Matched Grid Frequency" : "Mismatch/Absent",
        detail: `Grid ${result.enf_analysis.dominant_grid_hz ?? "N/A"}Hz · SNR ${formatFixed(result.enf_analysis.enf_snr_db, 1)}dB`,
        score: clampPercent(enfScore),
        confidence: toPercent(result.enf_analysis.confidence),
        color: enfMatched ? "success" : "danger",
      },
      {
        title: "Background Noise",
        status: roomStatus,
        detail: `Environment ${result.room_acoustic_analysis.acoustic_environment || "unknown"} · DRR ${formatFixed(result.room_acoustic_analysis.drr_db ?? 0, 1)}dB`,
        score: clampPercent(roomScore),
        confidence: toPercent(result.room_acoustic_analysis.confidence),
        color: toneFromScore(roomScore),
      },
      {
        title: "Temporal Artifacts",
        status: hasTemporalArtifacts ? "Discontinuous" : "Smooth",
        detail: hasTemporalArtifacts ? "Splice-like discontinuities detected" : "No splice discontinuity detected",
        score: toPercent(temporalScore),
        confidence: toPercent(Math.max(result.enf_analysis.confidence, result.room_acoustic_analysis.confidence)),
        color: hasTemporalArtifacts ? "danger" : "success",
      },
    ];
  }, [result]);

  const anomalyStartSec = timelineEvents.length > 0 ? timelineEvents[0].sec : null;
  const anomalyEndSec = timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1].sec : null;

  const seekToEvent = (eventId: string, sec: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = sec;
    setPlaybackTime(sec);
    setSelectedEvent(eventId);
  };

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const processFile = async (file: File, inputElement?: HTMLInputElement) => {
    if (!isSupportedAudio(file)) {
      setErrorMessage("Unsupported format. Please upload WAV, MP3, FLAC, OGG, M4A, AAC, or video files like MP4/MOV/WEBM.");
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const nextUrl = URL.createObjectURL(file);

    setAudioUrl(nextUrl);
    setSelectedFileName(file.name);
    setPlaybackTime(0);
    setSelectedEvent(null);
    setAudioDurationSec(0);
    setErrorMessage("");
    setReportId("");
    setResult(null);
    setIsLoading(true);

    try {
      const [analysis, waveform] = await Promise.all([
        analyzeAudioFile(file),
        buildWaveformFromFile(file).catch(() => DEFAULT_WAVE_HEIGHTS),
      ]);
      const nextReportId = createClientReportId("audio");
      setResult(analysis);
      setReportId(nextReportId);
      setWaveHeights(waveform);

      void persistHistoryEntry({
        media_type: "audio",
        verdict: analysis.final_verdict,
        confidence: analysis.authenticity_score,
        request_id: nextReportId,
        result: analysis,
      }).catch(() => {
        // Non-fatal: history persistence is best-effort in dev
      });
    } catch (error) {
      setWaveHeights(DEFAULT_WAVE_HEIGHTS);
      setErrorMessage(error instanceof Error ? error.message : "Audio analysis failed");
    } finally {
      setIsLoading(false);
      if (inputElement) inputElement.value = "";
    }
  };

  const handleAudioPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file, event.target);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const getWaveBarClassName = (idx: number): string => {
                    if (timelineEvents.length === 0) return "w-1 rounded-full bg-white/35";

                    const barSec = (idx / Math.max(1, waveHeights.length - 1)) * analysisDurationSec;
                    const nearEvent = timelineEvents.find((event) => Math.abs(event.sec - barSec) <= Math.max(analysisDurationSec / 40, 0.45));

                    if (!nearEvent) return "w-1 rounded-full bg-white/35";
                    if (nearEvent.kind === "splice" || nearEvent.kind === "anomaly") {
                      return "w-1 rounded-full bg-danger shadow-[0_0_12px_rgba(255,90,90,.45)]";
                    }

                    return "w-1 rounded-full bg-warning shadow-[0_0_10px_rgba(255,186,90,.35)]";
                  };

                  const spliceLocations = result?.enf_analysis.splice_locations_sec || [];

                  return (
                    <>
                      <div className="grain-overlay" />
                      <TopNav active="audio" />

                      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
                        <ScrollReveal>
                          <section className="mb-16 text-center">
                            <h1 className="mb-6 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
                              Analyze Audio Authenticity
                            </h1>
                            <p className="mx-auto max-w-3xl text-base text-white/70 sm:text-lg">
                              Detect synthesized speech, prosodic anomalies, and electric-network-frequency mismatch.
                            </p>
                          </section>
                        </ScrollReveal>

                        <ScrollReveal delayMs={40}>
                          <section className="mb-16">
                            <Card 
                              className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center sm:p-8 md:p-10 transition-colors hover:border-white/40" 
                              variant="secondary"
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                            >
                              <Card.Header className="items-center gap-3">
                                <Card.Title className="text-xl text-white sm:text-2xl">Drag &amp; Drop the audio</Card.Title>
                                <Card.Description className="text-white/60">Supported formats: MP3, WAV, FLAC, OGG, M4A, AAC, MP4, MOV, AVI, MKV, WEBM</Card.Description>
                              </Card.Header>
                              <Card.Footer className="flex-col justify-center gap-3 sm:flex-row">
                                <input
                                  ref={inputRef}
                                  type="file"
                                  accept="audio/*,video/*"
                                  className="hidden"
                                  onChange={handleAudioPick}
                                />
                                <Button size="lg" className="rounded-full px-10" onPress={handleUploadClick} isDisabled={isLoading}>
                                  {isLoading ? loadingMessage : "Upload Audio"}
                                </Button>
                                <Chip size="sm" variant="secondary">{selectedFileName || "No file selected"}</Chip>
                              </Card.Footer>
                            </Card>
                          </section>
                        </ScrollReveal>

                        <ScrollReveal delayMs={60}>
                          <section className="grid gap-6 xl:grid-cols-12">
                            <div className="space-y-6 xl:col-span-6">
                              <Card className="border border-white/10 p-6 xl:h-[420px]" variant="secondary">
                                <Card.Header className="items-end justify-between gap-4 md:flex-row">
                                  <div>
                                    <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">
                                      Spectral Waveform Analysis
                                    </Card.Description>
                                    <Card.Title className="text-lg text-white">Live anomaly-aware waveform view</Card.Title>
                                  </div>
                                  <div className="flex gap-2">
                                    <Chip color={verdict?.tone || "warning"} size="sm" variant="soft">
                                      {verdict?.chipLabel || "Awaiting Analysis"}
                                    </Chip>
                                    <Chip size="sm" variant="secondary">AI likelihood {aiLikelihoodPercent}%</Chip>
                                  </div>
                                </Card.Header>
                                <Card.Content className="flex h-full flex-col justify-between">
                                  <div className="mt-6 flex h-52 items-center justify-between gap-1">
                                    {waveHeights.map((height, idx) => (
                                      <div
                                        key={`${height}-${idx}`}
                                        style={{ height: `${height * 2.4}px` }}
                                        className={getWaveBarClassName(idx)}
                                      />
                                    ))}
                                  </div>
                                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
                                    <span>
                                      {formatTime(playbackTime)} / {formatTime(analysisDurationSec)}
                                    </span>
                                    <span>
                                      {anomalyStartSec !== null && anomalyEndSec !== null
                                        ? `Anomaly cluster: ${formatTime(anomalyStartSec)} — ${formatTime(anomalyEndSec)}`
                                        : "No anomaly cluster detected"}
                                    </span>
                                  </div>
                                </Card.Content>
                              </Card>

                              <Card className="border border-white/10 p-6" variant="secondary">
                                <Card.Header className="items-start justify-between gap-4 md:flex-row md:items-center">
                                  <div>
                                    <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">
                                      Timeline-to-Playback
                                    </Card.Description>
                                    <Card.Title className="text-lg text-white">Click anomaly markers to seek playback</Card.Title>
                                  </div>
                                  <Chip size="sm" variant="secondary">
                                    {timelineEvents.length} timeline points
                                  </Chip>
                                </Card.Header>
                                <Card.Content className="space-y-5">
                                  <audio
                                    ref={audioRef}
                                    controls
                                    className="w-full"
                                    src={audioUrl || undefined}
                                    onLoadedMetadata={(event) => setAudioDurationSec(event.currentTarget.duration || 0)}
                                    onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
                                  />

                                  {!audioUrl ? (
                                    <p className="text-xs text-white/50">Upload an audio file to enable playback, waveform, and timeline seeking.</p>
                                  ) : null}

                                  {isLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-white/70">
                                      <Spinner size="sm" />
                                      {loadingMessage}
                                    </div>
                                  ) : null}

                                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                                    <div className="space-y-4">
                                      <div className="relative h-8 rounded-full border border-white/10 bg-white/[0.03]">
                                        <div className="absolute inset-y-0 left-0 rounded-full bg-white/10" style={{ width: `${(playbackTime / analysisDurationSec) * 100}%` }} />
                                        {timelineEvents.map((event) => (
                                          <button
                                            key={event.id}
                                            type="button"
                                            aria-label={`Seek to ${event.label}`}
                                            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform hover:scale-110 ${
                                              event.kind === "splice" || event.kind === "anomaly" ? "border-danger bg-danger/80" : "border-warning bg-warning/80"
                                            } ${selectedEvent === event.id ? "ring-2 ring-white/80" : ""}`}
                                            style={{ left: `${(event.sec / analysisDurationSec) * 100}%` }}
                                            onClick={() => seekToEvent(event.id, event.sec)}
                                          />
                                        ))}
                                      </div>

                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {timelineEvents.map((event) => (
                                          <button
                                            key={`${event.id}-row`}
                                            type="button"
                                            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                                              selectedEvent === event.id
                                                ? "border-white/35 bg-white/10 text-white"
                                                : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/10"
                                            }`}
                                            onClick={() => seekToEvent(event.id, event.sec)}
                                          >
                                            <span className="line-clamp-1">{event.label}</span>
                                            <span className="ml-3 text-xs uppercase tracking-[0.14em] text-white/50">{formatTime(event.sec)}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                                      <p className="mb-3 text-xs uppercase tracking-[0.16em] text-white/45">Splice Windows</p>
                                      <div className="space-y-2">
                                        {spliceLocations.length > 0 ? (
                                          spliceLocations.map((sec, idx) => (
                                            <button
                                              key={`splice-window-${idx}`}
                                              type="button"
                                              className="flex w-full items-center justify-between rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-left text-sm text-danger"
                                              onClick={() => seekToEvent(`splice-${idx}`, sec)}
                                            >
                                              <span>Splice #{idx + 1}</span>
                                              <span className="text-xs uppercase tracking-[0.14em]">{formatTime(sec)}</span>
                                            </button>
                                          ))
                                        ) : (
                                          <p className="text-sm text-white/60">No splice windows detected.</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </Card.Content>
                              </Card>
                            </div>

                            <div className="space-y-6 xl:col-span-6 xl:sticky xl:top-28 xl:self-start">
                              <Card className="border border-white/10 p-8 text-center xl:h-[420px]" variant="secondary">
                                <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                                  AI Voice Manipulation Risk
                                </Card.Description>
                                <Card.Content className="mt-6 flex h-full flex-col items-center justify-between gap-6">
                                  <div className="w-full max-w-[240px]">
                                    <div className="text-5xl font-semibold tracking-tight text-white">
                                      {result ? `${aiLikelihoodPercent}%` : "--"}
                                    </div>
                                    <ProgressBar aria-label="Audio AI voice risk score" value={result ? aiLikelihoodPercent : 0} size="sm" color={verdict?.tone || "warning"} className="mt-3 w-full">
                                      <ProgressBar.Track>
                                        <ProgressBar.Fill />
                                      </ProgressBar.Track>
                                    </ProgressBar>
                                  </div>
                                  <Chip color={verdict?.tone || "warning"} variant="soft">
                                    {verdict?.chipLabel || "Awaiting Analysis"}
                                  </Chip>
                                  <div className="w-full space-y-2 text-left text-sm text-white/65">
                                    <div className="flex justify-between"><span>Authenticity</span><span>{result ? `${authenticityPercent}%` : "-"}</span></div>
                                    <div className="flex justify-between"><span>Confidence</span><span>{result ? `${confidencePercent}%` : "-"}</span></div>
                                    <div className="flex justify-between"><span>Latency</span><span>{formatLatency(result)}</span></div>
                                    <div className="flex justify-between"><span>Sample Rate</span><span>{result ? `${(result.sample_rate_hz / 1000).toFixed(1)}kHz` : "-"}</span></div>
                                    <div className="flex justify-between"><span>Report ID</span><span className="font-mono text-xs">{reportId || "-"}</span></div>
                                  </div>
                                  <div className="mt-3 w-full rounded-full border border-white/15 bg-white/5 px-4 py-3 text-center text-sm text-white/70">
                                    {reportId ? "Verification ID ready for export workflows" : "Verification ID will appear after analysis"}
                                  </div>
                                </Card.Content>
                              </Card>

                              <Card className="border border-white/10 p-6" variant="secondary">
                                <Card.Header className="items-start justify-between gap-4 md:flex-row md:items-center">
                                  <div>
                                    <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">
                                      Explainability
                                    </Card.Description>
                                    <Card.Title className="text-lg text-white">Flags &amp; anomalies extracted from analysis</Card.Title>
                                  </div>
                                  <Chip size="sm" variant="secondary">
                                    {(result?.all_flags.length || 0) + (result?.all_anomalies.length || 0)} findings
                                  </Chip>
                                </Card.Header>
                                <Card.Content className="space-y-5">
                                  <div>
                                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">all_flags</p>
                                    <div className="flex flex-wrap gap-2">
                                      {(result?.all_flags || []).length > 0 ? (
                                        result?.all_flags.map((flag) => (
                                          <Chip key={flag} color="danger" size="sm" variant="soft">
                                            {flag}
                                          </Chip>
                                        ))
                                      ) : (
                                        <p className="text-sm text-white/60">No flags detected.</p>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">all_anomalies</p>
                                    <div className="space-y-2">
                                      {(result?.all_anomalies || []).length > 0 ? (
                                        result?.all_anomalies.map((anomaly) => (
                                          <div key={anomaly} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/70">
                                            {anomaly}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/70">No anomalies detected.</div>
                                      )}
                                    </div>
                                  </div>
                                </Card.Content>
                              </Card>

                              {errorMessage ? (
                                <Card className="border border-danger/30 p-4" variant="secondary">
                                  <Card.Description className="text-danger">{errorMessage}</Card.Description>
                                </Card>
                              ) : null}
                            </div>
                          </section>
                        </ScrollReveal>

                        <ScrollReveal delayMs={80}>
                          <section className="mt-8 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                            {signalCards.map((layer) => (
                              <Card key={layer.title} className="border border-white/10 p-6" variant="secondary">
                                <Card.Header className="items-center justify-between">
                                  <Card.Title className="text-base text-white">{layer.title}</Card.Title>
                                  <Chip color={layer.color} size="sm" variant="soft">
                                    {layer.status}
                                  </Chip>
                                </Card.Header>
                                <Card.Content>
                                  <p className="text-sm text-white/65">{layer.detail}</p>

                                  <div className="mt-4 space-y-3">
                                    <div>
                                      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-white/50">
                                        <span>Layer Score</span>
                                        <span>{layer.score}%</span>
                                      </div>
                                      <ProgressBar
                                        aria-label={`${layer.title} score`}
                                        value={layer.score}
                                        size="sm"
                                        color={layer.color}
                                      >
                                        <ProgressBar.Track>
                                          <ProgressBar.Fill />
                                        </ProgressBar.Track>
                                      </ProgressBar>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                                      <span className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                                        Confidence
                                      </span>
                                      <Chip size="sm" variant="secondary" className="!text-white">
                                        {layer.confidence}%
                                      </Chip>
                                    </div>
                                  </div>
                                </Card.Content>
                              </Card>
                            ))}
                          </section>
                        </ScrollReveal>
                      </main>

                      <SiteFooter />
                    </>
                  );
                }
