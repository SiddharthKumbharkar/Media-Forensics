"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { type DragEvent } from "react";
import Image from "next/image";
import { Button, Card, Chip, ProgressBar, Spinner } from "@heroui/react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteFooter, TopNav } from "@/components/chrome";
import { getMediaConfig, isAllowedMediaFile } from "@/lib/analysis/media";
import {
  getBreakdownEntries,
  getBreakdownLabel,
  getEngineDescription,
  getVerdictView,
  toPercent,
} from "@/lib/analysis/presentation";
import type { AnalysisResponse, MediaType } from "@/lib/analysis/types";
import { analyzeAudioFile } from "@/lib/audio-forensics/api";
import { persistHistoryEntry } from "@/lib/history-client";
import { useLoadingMessages } from "@/hooks/use-loading-messages";
import { analyzeImageFile } from "@/lib/image-forensics/api";
import { analyzeVideoFile } from "@/lib/video-forensics/api";

const LOADING_MESSAGES: Record<MediaType, string[]> = {
  image: [
    "Uploading image for secure analysis...",
    "Running visual integrity checks...",
    "Normalizing the risk assessment...",
  ],
  audio: [
    "Uploading audio for secure analysis...",
    "Running authenticity checks...",
    "Normalizing the risk assessment...",
  ],
  video: [
    "Uploading video for secure analysis...",
    "Running frame and signal checks...",
    "Normalizing the risk assessment...",
  ],
};

interface MediaAnalysisPageProps {
  mediaType: MediaType;
}

const ANALYZE_FILE_BY_MEDIA_TYPE: Record<MediaType, (file: File) => Promise<AnalysisResponse>> = {
  image: analyzeImageFile,
  audio: analyzeAudioFile,
  video: analyzeVideoFile,
};

function MediaPreview({ mediaType, previewUrl }: { mediaType: MediaType; previewUrl: string }) {
  if (mediaType === "image") {
    return (
      <div className="relative aspect-video">
        <Image
          src={previewUrl}
          alt="Selected media preview"
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-contain"
          unoptimized
        />
      </div>
    );
  }

  if (mediaType === "video") {
    return <video src={previewUrl} controls className="aspect-video w-full object-contain" />;
  }

  return (
    <div className="flex min-h-[240px] items-center justify-center px-6">
      <audio src={previewUrl} controls className="w-full" />
    </div>
  );
}

export function MediaAnalysisPage({ mediaType }: MediaAnalysisPageProps) {
  const config = getMediaConfig(mediaType);
  const analyzeFile = ANALYZE_FILE_BY_MEDIA_TYPE[mediaType];
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const loadingMessage = useLoadingMessages(isLoading, LOADING_MESSAGES[mediaType]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const verdict = getVerdictView(result?.final_verdict);
  const aiRiskPercent = result ? toPercent(result.fake_probability) : 0;
  const confidencePercent = result ? toPercent(result.confidence) : 0;
  const breakdownEntries = getBreakdownEntries(result);

  const processFile = async (file: File, inputElement?: HTMLInputElement) => {
    if (!isAllowedMediaFile(mediaType, file)) {
      setErrorMessage("Unsupported file type.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFileName(file.name);
    setErrorMessage("");
    setResult(null);
    setIsLoading(true);

    try {
      const analysis = await analyzeFile(file);
      setResult(analysis);

      void persistHistoryEntry({
        media_type: mediaType,
        verdict: analysis.final_verdict,
        confidence: analysis.confidence,
        request_id: analysis.request_id,
        result: analysis,
      }).catch(() => {
        // History is best-effort for the local UI.
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsLoading(false);
      if (inputElement) inputElement.value = "";
    }
  };

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file, event.target);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <>
      <div className="grain-overlay" />
      <TopNav active={mediaType} />

      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
        <ScrollReveal>
          <section className="mb-16 text-center">
            <h1 className="mb-6 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
              {config.title}
            </h1>
            <p className="mx-auto max-w-3xl text-base font-light text-white/70 sm:text-lg">
              {config.description}
            </p>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={40}>
          <section className="mb-16">
            <Card
              className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center transition-colors hover:border-white/40 sm:p-8 md:p-10"
              variant="secondary"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Card.Header className="items-center gap-3">
                <Card.Title className="text-xl text-white sm:text-2xl">
                  Drag and drop your file
                </Card.Title>
                <Card.Description className="text-white/60">
                  {config.supportedFormatsLabel}
                </Card.Description>
              </Card.Header>
              <Card.Footer className="mt-3 flex-col gap-3 sm:flex-row sm:justify-center">
                <input
                  ref={inputRef}
                  type="file"
                  accept={config.accept}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="lg"
                  className="rounded-full px-10"
                  onPress={handleUploadClick}
                  isDisabled={isLoading}
                >
                  {isLoading ? loadingMessage : config.uploadLabel}
                </Button>
                <Chip size="sm" variant="secondary">
                  {selectedFileName || "No file selected"}
                </Chip>
              </Card.Footer>
            </Card>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={70}>
          <section className="mb-12 grid gap-8 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <Card className="overflow-hidden border border-white/10" variant="secondary">
                <div className="relative min-h-[280px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.12),transparent_45%),linear-gradient(145deg,#101010,#202020,#101010)]">
                  {previewUrl ? (
                    <MediaPreview mediaType={mediaType} previewUrl={previewUrl} />
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center px-6 text-center text-sm text-white/45">
                      Upload a file to preview it here before or during analysis.
                    </div>
                  )}

                  {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-6 py-4 text-center text-white">
                        <Spinner size="md" color="accent" />
                        <span className="text-sm font-medium">{loadingMessage}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="space-y-5 xl:col-span-5">
              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Description className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Analysis Result
                </Card.Description>
                <Card.Content className="space-y-6 pt-5">
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">AI Risk Score</p>
                        <p className="text-5xl font-semibold tracking-tight text-white">
                          {result ? `${aiRiskPercent}%` : "--"}
                        </p>
                      </div>
                      {result ? (
                        <Chip color={verdict.tone} size="sm" variant="soft">
                          {verdict.chipLabel}
                        </Chip>
                      ) : null}
                    </div>
                    <ProgressBar
                      aria-label="AI risk score"
                      value={aiRiskPercent}
                      size="sm"
                      color={verdict.tone}
                      className="w-full"
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                    <p className="text-sm text-white/60">
                      {result ? verdict.summary : "Upload a file to receive a normalized authenticity assessment."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="border border-white/10 p-4" variant="secondary">
                      <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                        Verdict
                      </Card.Description>
                      <Card.Content className="pt-3 text-lg text-white">
                        {result ? result.final_verdict : "-"}
                      </Card.Content>
                    </Card>

                    <Card className="border border-white/10 p-4" variant="secondary">
                      <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                        Confidence
                      </Card.Description>
                      <Card.Content className="pt-3 text-lg text-white">
                        {result ? `${confidencePercent}%` : "-"}
                      </Card.Content>
                    </Card>

                    <Card className="border border-white/10 p-4" variant="secondary">
                      <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                        Analysis Engine
                      </Card.Description>
                      <Card.Content className="pt-3 text-lg text-white">
                        {result ? getEngineDescription(result.analysis_engine) : "-"}
                      </Card.Content>
                    </Card>
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

        {breakdownEntries.length > 0 ? (
          <ScrollReveal delayMs={100}>
            <section className="mb-16">
              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Header className="items-start gap-3">
                  <div>
                    <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                      Optional Breakdown
                    </Card.Description>
                    <Card.Title className="text-xl italic text-white">
                      Generic engine comparison
                    </Card.Title>
                  </div>
                </Card.Header>
                <Card.Content className="grid gap-4 pt-4 md:grid-cols-2">
                  {breakdownEntries.map((entry) => (
                    <Card key={entry.source} className="border border-white/10 p-4" variant="secondary">
                      <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                        {getBreakdownLabel(entry.source)}
                      </Card.Description>
                      <Card.Content className="space-y-3 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/60">AI Risk Score</span>
                          <span className="text-white">{toPercent(entry.fake_probability)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/60">Confidence</span>
                          <span className="text-white">{toPercent(entry.confidence)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/60">Verdict</span>
                          <span className="text-white">{entry.verdict}</span>
                        </div>
                      </Card.Content>
                    </Card>
                  ))}
                </Card.Content>
              </Card>
            </section>
          </ScrollReveal>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
