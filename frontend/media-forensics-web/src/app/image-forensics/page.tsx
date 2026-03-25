"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button, Card, Chip, ProgressBar, Spinner, Table } from "@heroui/react";
import Image from "next/image";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";
import { analyzeImageFile } from "@/lib/image-forensics/api";
import {
  formatFixed,
  getSignalAgreementConfidence,
  getVerdictFromUnifiedResult,
  toPercent,
} from "@/lib/image-forensics/presentation";
import type { Layer1Output } from "@/lib/image-forensics/types";

type CardTone = "success" | "warning" | "danger";

interface SignalCard {
  label: string;
  status: string;
  tone: CardTone;
}

function formatDuration(milliseconds: number | undefined): string {
  if (!milliseconds) return "-";
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function getVerdictChipLabel(tone: CardTone): string {
  if (tone === "success") return "Likely Real";
  if (tone === "warning") return "Inconclusive";
  return "Likely AI/Tampered";
}

export default function ImageForensicsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [result, setResult] = useState<Layer1Output | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const scorePercent = result ? toPercent(result.authenticity_score) : 0;
  const aiRiskPercent = result ? 100 - scorePercent : 0;
  const verdict = result ? getVerdictFromUnifiedResult(result) : null;
  const confidencePercent = result ? toPercent(getSignalAgreementConfidence(result)) : 0;

  const signalCards: SignalCard[] = useMemo(() => {
    if (!result) {
      return [
        { label: "Metadata Integrity", status: "Pending", tone: "warning" },
        { label: "LSB Steganography", status: "Pending", tone: "warning" },
        { label: "DCT Steganography", status: "Pending", tone: "warning" },
        { label: "PRNU Pattern", status: "Pending", tone: "warning" },
      ];
    }

    const metadataTone: CardTone = result.metadata.exif_consistent ? "success" : "danger";
    const lsbTone: CardTone = result.steganography.lsb_anomaly ? "danger" : "success";
    const dctTone: CardTone = result.steganography.dct_anomaly ? "danger" : "success";
    const prnuTone: CardTone = result.prnu.prnu_score >= 0.65 ? "success" : result.prnu.prnu_score >= 0.4 ? "warning" : "danger";

    return [
      {
        label: "Metadata Integrity",
        status: result.metadata.exif_consistent ? "Pass" : "Flagged",
        tone: metadataTone,
      },
      {
        label: "LSB Steganography",
        status: result.steganography.lsb_anomaly ? "Anomaly" : "Clean",
        tone: lsbTone,
      },
      {
        label: "DCT Steganography",
        status: result.steganography.dct_anomaly ? "Anomaly" : "Clean",
        tone: dctTone,
      },
      {
        label: "PRNU Pattern",
        status: `${toPercent(result.prnu.prnu_score)}% match`,
        tone: prnuTone,
      },
    ];
  }, [result]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload a valid image file.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setErrorMessage("");
    setIsLoading(true);
    setSelectedFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);

    try {
      const payload = await analyzeImageFile(file);
      setResult(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Image analysis failed");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="image" />

      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
        <ScrollReveal>
          <section className="mb-16 text-center">
            <h1 className="mb-6 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
              Analyze Image Authenticity
            </h1>
            <p className="mx-auto max-w-3xl text-base font-light text-white/70 sm:text-lg">
              Detect pixel-level manipulations, synthetic generation artifacts, and metadata
              inconsistencies using forensic vision models.
            </p>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={40}>
          <section className="mb-20">
          <Card className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center sm:p-8 md:p-10" variant="secondary">
            <Card.Header className="items-center gap-3">
              <Card.Title className="text-xl text-white sm:text-2xl">Drag &amp; Drop the Image</Card.Title>
              <Card.Description className="text-white/60">Supported formats: PNG, JPG, TIFF, WEBP</Card.Description>
            </Card.Header>
            <Card.Footer className="mt-3 flex-col gap-3 sm:flex-row sm:justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button size="lg" className="rounded-full px-10" onPress={handleUploadClick} isDisabled={isLoading}>
                {isLoading ? "Analyzing..." : "Upload Image"}
              </Button>
              <Chip size="sm" variant="secondary">
                {selectedFileName || "No file selected"}
              </Chip>
            </Card.Footer>
          </Card>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <section className="mb-16 grid gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <Card className="overflow-hidden border border-white/10" variant="secondary">
              <div className="relative aspect-video bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.12),transparent_45%),linear-gradient(145deg,#101010,#202020,#101010)]">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Uploaded media preview"
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-contain"
                    unoptimized
                  />
                ) : null}

                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <div className="flex items-center gap-3 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-white">
                      <Spinner size="sm" />
                      <span className="text-sm">Running image forensic checks...</span>
                    </div>
                  </div>
                ) : null}

                {result && !isLoading ? (
                  <>
                    <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs uppercase tracking-wider text-white">
                      {result.metadata.exif_consistent ? "Metadata Consistent" : "Metadata Warning"}
                    </div>
                    <div className="absolute bottom-4 right-4 rounded-full border border-white/25 bg-black/50 px-3 py-1 text-xs uppercase tracking-wider text-white">
                      PRNU {toPercent(result.prnu.prnu_score)}%
                    </div>
                  </>
                ) : null}
              </div>
              <Card.Footer className="flex justify-between text-xs uppercase tracking-[0.16em] text-white/45">
                <span>Pipeline: EXIF + Steg + PRNU + C2PA + EfficientNet</span>
                <span>Processing: {formatDuration(result?.processing_ms)}</span>
              </Card.Footer>
            </Card>

            {errorMessage ? (
              <Card className="border border-danger/30 p-4" variant="secondary">
                <Card.Description className="text-danger">{errorMessage}</Card.Description>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5 lg:col-span-5">
            <Card className="border border-white/10 p-6" variant="secondary">
              <Card.Content className="flex items-center gap-6">
                <div className="flex min-w-[130px] flex-col items-center gap-2">
                  <div className="text-4xl font-semibold tracking-tight text-white">
                    {result ? `${scorePercent}%` : "--"}
                  </div>
                  <ProgressBar
                    aria-label="Image authenticity score"
                    value={result ? scorePercent : 0}
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
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Unified Authenticity Confidence (Forensics + ML)
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-3xl italic text-white">{verdict?.label || "Awaiting Upload"}</p>
                    {verdict ? (
                      <Chip color={verdict.tone} size="sm" variant="soft">
                        {getVerdictChipLabel(verdict.tone)}
                      </Chip>
                    ) : null}
                  </div>
                  {result ? (
                    <p className="mt-1 text-xs text-white/55">Estimated AI/tamper risk: {aiRiskPercent}%</p>
                  ) : null}
                  <p className="mt-2 text-xs text-white/60">
                    {verdict?.summary || "Upload an image to start backend forensic analysis."}
                  </p>
                </div>
              </Card.Content>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {signalCards.map((item) => (
                <Card key={item.label} className="border border-white/10 p-4" variant="secondary">
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                    {item.label}
                  </Card.Description>
                  <Card.Content className="pt-3">
                    <Chip color={item.tone} size="sm" variant="soft">
                      {item.status}
                    </Chip>
                  </Card.Content>
                </Card>
              ))}
            </div>

            <Card className="border border-white/10 p-6" variant="secondary">
              <Card.Title className="text-sm uppercase tracking-[0.16em] text-white/60">AI Model Analysis</Card.Title>
              <Card.Content className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.16em] text-white/45">Model</span>
                  <span className="text-sm text-white">{result?.ml_prediction.model || "EfficientNet"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.16em] text-white/45">Label</span>
                  <Chip
                    color={
                      result
                        ? result.ml_prediction.label === "Real"
                          ? "success"
                          : "danger"
                        : "warning"
                    }
                    size="sm"
                    variant="soft"
                  >
                    {result ? result.ml_prediction.label : "Pending"}
                  </Chip>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.16em] text-white/45">Confidence</span>
                  <span className="text-sm text-white">
                    {result ? `${toPercent(result.ml_prediction.confidence)}%` : "-"}
                  </span>
                </div>
              </Card.Content>
            </Card>
          </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <section className="mb-20">
          <Card className="border border-white/10 p-6" variant="secondary">
            <Card.Title className="mb-4 font-headline text-3xl italic text-white">Forensic Breakdown</Card.Title>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Forensic breakdown">
                  <Table.Header>
                    <Table.Column isRowHeader>Field</Table.Column>
                    <Table.Column>Value</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell>Verdict</Table.Cell>
                      <Table.Cell>{result ? result.verdict : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Authenticity Score</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.authenticity_score, 4) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Layer1 Score</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.layer1_score, 4) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Confidence</Table.Cell>
                      <Table.Cell>{result ? `${confidencePercent}%` : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>EXIF Score</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.metadata.exif_score, 4) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Steg Score</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.steganography.steg_score, 4) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>PRNU Score</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.prnu.prnu_score, 4) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Noise Variance</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.prnu.noise_variance, 6) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Spatial Correlation</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.prnu.spatial_correlation, 6) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>ML Label</Table.Cell>
                      <Table.Cell>{result ? result.ml_prediction.label : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>ML Confidence</Table.Cell>
                      <Table.Cell>{result ? `${toPercent(result.ml_prediction.confidence)}%` : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>C2PA Score</Table.Cell>
                      <Table.Cell>{result ? formatFixed(result.c2pa.c2pa_score, 4) : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>C2PA Note</Table.Cell>
                      <Table.Cell>{result ? result.c2pa.note : "-"}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Physics Violations</Table.Cell>
                      <Table.Cell>
                        {result
                          ? result.metadata.physics_violations.length > 0
                            ? result.metadata.physics_violations.join(" • ")
                            : "None"
                          : "-"}
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card>
          </section>
        </ScrollReveal>
      </main>

      <SiteFooter />
    </>
  );
}
