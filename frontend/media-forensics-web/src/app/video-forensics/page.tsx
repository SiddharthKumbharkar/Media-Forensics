"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button, Card, Chip, ProgressBar, Spinner } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";
import { analyzeVideoFile } from "@/lib/video-forensics/api";
import {
  formatFixed,
  getModelSummaries,
  getTimelineInsight,
  getVerdictView,
  toPercent,
} from "@/lib/video-forensics/presentation";
import type { VideoForensicsResult } from "@/lib/video-forensics/types";

const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".avi", ".mkv"]);

function getFileExtension(filename: string | undefined): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function isSupportedVideo(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return SUPPORTED_VIDEO_EXTENSIONS.has(getFileExtension(file.name));
}

export default function VideoForensicsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [result, setResult] = useState<VideoForensicsResult | null>(null);

  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  const verdict = result ? getVerdictView(result) : null;
  const fakeProbabilityPercent = result ? toPercent(result.deepfake_probability) : 0;
  const authenticityPercent = result ? Math.max(0, 100 - fakeProbabilityPercent) : 0;
  const verdictConfidencePercent = result
    ? result.is_likely_deepfake
      ? fakeProbabilityPercent
      : authenticityPercent
    : 0;

  const timeline = useMemo(() => getTimelineInsight(result?.model_results), [result]);
  const modelSummaries = useMemo(() => getModelSummaries(result?.model_results), [result]);

  const timelinePeak = useMemo(() => {
    if (timeline.points.length === 0) return null;
    return timeline.points.reduce((peak, current) => (current.score > peak.score ? current : peak), timeline.points[0]);
  }, [timeline]);

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleVideoPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isSupportedVideo(file)) {
      setErrorMessage("Unsupported format. Please upload MP4, M4V, MOV, AVI, or MKV.");
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextVideoUrl = URL.createObjectURL(file);

    setVideoUrl(nextVideoUrl);
    setSelectedFileName(file.name);
    setResult(null);
    setErrorMessage("");
    setIsLoading(true);

    try {
      const payload = await analyzeVideoFile(file);
      setResult(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Video analysis failed");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="video" />

      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
        <ScrollReveal>
          <section className="mb-16 text-center">
            <h1 className="mb-6 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
              Analyze Video Authenticity
            </h1>
            <p className="mx-auto max-w-3xl text-base font-light text-white/70 sm:text-lg">
              Ensemble deepfake inference with temporal signal extraction, model-level voting,
              and confidence diagnostics from live backend analysis.
            </p>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={40}>
          <section className="mb-20">
            <Card className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center sm:p-8 md:p-10" variant="secondary">
              <Card.Header className="items-center gap-3">
                <Card.Title className="text-xl text-white sm:text-2xl">Drag &amp; Drop the video</Card.Title>
                <Card.Description className="text-white/60">Supported formats: MP4, M4V, MOV, AVI, MKV</Card.Description>
              </Card.Header>
              <Card.Footer className="mt-3 flex-col gap-3 sm:flex-row sm:justify-center">
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/mp4,video/x-m4v,video/quicktime,video/x-msvideo,video/x-matroska"
                  className="hidden"
                  onChange={handleVideoPick}
                />
                <Button size="lg" className="rounded-full px-10" onPress={handleUploadClick} isDisabled={isLoading}>
                  {isLoading ? "Analyzing..." : "Upload Video"}
                </Button>
                <Chip size="sm" variant="secondary">
                  {selectedFileName || "No file selected"}
                </Chip>
              </Card.Footer>
            </Card>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <section className="mb-16 grid gap-8 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-7">
              <Card className="overflow-hidden border border-white/10" variant="secondary">
                <div className="relative aspect-video bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.12),transparent_45%),linear-gradient(145deg,#101010,#202020,#101010)]">
                  {videoUrl ? (
                    <video src={videoUrl} controls className="h-full w-full object-contain" />
                  ) : null}

                  {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <div className="flex items-center gap-3 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-white">
                        <Spinner size="sm" />
                        <span className="text-sm">Running Video Forensics on your video...</span>
                      </div>
                    </div>
                  ) : null}

                  {result && !isLoading ? (
                    <>
                      <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs uppercase tracking-wider text-white">
                        {result.is_likely_deepfake ? "Deepfake Signal Detected" : "No High-Risk Signal"}
                      </div>
                      <div className="absolute bottom-4 right-4 rounded-full border border-white/25 bg-black/50 px-3 py-1 text-xs uppercase tracking-wider text-white">
                        Ensemble {result.ensemble_method_used}
                      </div>
                    </>
                  ) : null}
                </div>
                <Card.Footer className="flex justify-between text-xs uppercase tracking-[0.16em] text-white/45">
                  <span>Pipeline: DeepSafe /detect → ensemble verdict</span>
                  <span>Response: {result ? `${formatFixed(result.response_time, 2)}s` : "-"}</span>
                </Card.Footer>
              </Card>

              {errorMessage ? (
                <Card className="border border-danger/30 p-4" variant="secondary">
                  <Card.Description className="text-danger">{errorMessage}</Card.Description>
                </Card>
              ) : null}
            </div>

            <div className="space-y-5 xl:col-span-5">
              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Content className="flex items-center gap-6">
                  <div className="flex min-w-[130px] flex-col items-center gap-2">
                    <div className="text-4xl font-semibold tracking-tight text-white">{result ? `${authenticityPercent}%` : "--"}</div>
                    <ProgressBar
                      aria-label="Video authenticity score"
                      value={result ? authenticityPercent : 0}
                      size="sm"
                      color={verdict?.tone || "warning"}
                      className="w-full"
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Authenticity Confidence</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-3xl italic text-white">{verdict?.label || "Awaiting Upload"}</p>
                      {verdict ? (
                        <Chip color={verdict.tone} size="sm" variant="soft">
                          {verdict.chipLabel}
                        </Chip>
                      ) : null}
                    </div>
                    {result ? <p className="mt-1 text-xs text-white/55">Deepfake probability: {fakeProbabilityPercent}%</p> : null}
                    <p className="mt-2 text-xs text-white/60">
                      {verdict?.summary || "Upload a video to run DeepSafe ensemble analysis."}
                    </p>
                  </div>
                </Card.Content>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Card className="border border-white/10 p-4" variant="secondary">
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">Verdict Confidence</Card.Description>
                  <Card.Content className="pt-3">
                    <p className="text-2xl text-white">{result ? `${verdictConfidencePercent}%` : "-"}</p>
                    <p className="text-xs text-white/55">Max probability for predicted class</p>
                  </Card.Content>
                </Card>

                <Card className="border border-white/10 p-4" variant="secondary">
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">Vote Split</Card.Description>
                  <Card.Content className="pt-3">
                    <p className="text-2xl text-white">{result ? `${result.fake_votes}:${result.real_votes}` : "-"}</p>
                    <p className="text-xs text-white/55">Fake vs real base-model votes</p>
                  </Card.Content>
                </Card>

                <Card className="border border-white/10 p-4" variant="secondary">
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">Models Contributed</Card.Description>
                  <Card.Content className="pt-3">
                    <p className="text-2xl text-white">{result ? result.model_count : "-"}</p>
                    <p className="text-xs text-white/55">Successful model responses</p>
                  </Card.Content>
                </Card>

                <Card className="border border-white/10 p-4" variant="secondary">
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">Request ID</Card.Description>
                  <Card.Content className="pt-3">
                    <p className="line-clamp-1 text-sm text-white">{result?.request_id || "-"}</p>
                    <p className="text-xs text-white/55">Traceable backend analysis id</p>
                  </Card.Content>
                </Card>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <section className="mb-16 grid gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Header className="items-start justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">
                      Temporal Forensics
                    </Card.Description>
                    <Card.Title className="text-xl italic text-white">{timeline.title}</Card.Title>
                    <Card.Description className="mt-1 text-white/55">{timeline.subtitle}</Card.Description>
                  </div>
                  <Chip size="sm" variant="secondary">
                    {timeline.mode === "frame" ? "Frame-level" : timeline.mode === "model" ? "Model-level" : "Unavailable"}
                  </Chip>
                </Card.Header>
                <Card.Content>
                  {timeline.points.length > 0 ? (
                    <>
                      <div className="mt-6 flex h-52 items-end gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                        {timeline.points.map((point) => (
                          <div
                            key={point.id}
                            className={`flex-1 rounded-t-sm ${
                              point.score >= 0.7 ? "bg-danger/60" : point.score >= 0.5 ? "bg-warning/60" : "bg-success/55"
                            }`}
                            style={{ height: `${Math.max(8, Math.round(point.score * 100))}%` }}
                            title={`${point.label}: ${toPercent(point.score)}%`}
                          />
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
                        <span>{timeline.mode === "frame" ? "Start frame" : "Model 1"}</span>
                        <span>
                          {timelinePeak
                            ? `Peak ${timelinePeak.label}: ${toPercent(timelinePeak.score)}%`
                            : "No confidence peak available"}
                        </span>
                        <span>{timeline.mode === "frame" ? "End frame" : `Model ${timeline.points.length}`}</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/65">
                      Upload and analyze a video to view temporal/model confidence traces.
                    </div>
                  )}
                </Card.Content>
              </Card>
            </div>

            <div className="xl:col-span-4">
              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Title className="text-sm uppercase tracking-[0.16em] text-white/60">Forensic Summary</Card.Title>
                <Card.Content className="space-y-4 pt-4 text-sm text-white/75">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span>Media Type</span>
                    <span className="font-medium text-white">{result?.media_type_processed || "video"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span>Processing Mode</span>
                    <span className="font-medium text-white">{result?.processing_mode || "CPU-only"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span>Ensemble Method</span>
                    <span className="font-medium text-white">{result?.ensemble_method_used || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Latency</span>
                    <span className="font-medium text-white">{result ? `${formatFixed(result.response_time, 2)}s` : "-"}</span>
                  </div>
                </Card.Content>
              </Card>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={100}>
          <section className="mb-20">
            <Card className="border border-white/10 p-6" variant="secondary">
              <Card.Header className="items-start justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">Model Diagnostics</Card.Description>
                  <Card.Title className="text-xl italic text-white">Individual model confidence and verdicts</Card.Title>
                </div>
                <Chip size="sm" variant="secondary">
                  {modelSummaries.length} models
                </Chip>
              </Card.Header>
              <Card.Content className="pt-4">
                {modelSummaries.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/65">
                    Model-level details will appear after analysis completes.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {modelSummaries.map((model) => (
                      <Card key={model.id} className="border border-white/10 p-4" variant="secondary">
                        <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">{model.title}</Card.Description>
                        <Card.Content className="space-y-3 pt-3">
                          <div className="flex items-center justify-between">
                            <Chip
                              color={model.hasError ? "danger" : model.prediction.toLowerCase().includes("fake") ? "danger" : "success"}
                              size="sm"
                              variant="soft"
                            >
                              {model.prediction}
                            </Chip>
                            <span className="text-xs text-white/60">
                              {model.inferenceTimeSec !== null ? `${formatFixed(model.inferenceTimeSec, 2)}s` : "-"}
                            </span>
                          </div>
                          <div>
                            <p className="text-2xl font-light italic text-white">{model.probabilityPercent}%</p>
                            <ProgressBar
                              aria-label={`${model.title} fake probability`}
                              value={model.probabilityPercent}
                              size="sm"
                              color={
                                model.probabilityPercent >= 70
                                  ? "danger"
                                  : model.probabilityPercent >= 50
                                    ? "warning"
                                    : "success"
                              }
                            >
                              <ProgressBar.Track>
                                <ProgressBar.Fill />
                              </ProgressBar.Track>
                            </ProgressBar>
                          </div>
                        </Card.Content>
                      </Card>
                    ))}
                  </div>
                )}
              </Card.Content>
            </Card>
          </section>
        </ScrollReveal>
      </main>

      <SiteFooter />
    </>
  );
}
