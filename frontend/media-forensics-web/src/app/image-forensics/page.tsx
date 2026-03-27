"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button, Card, Chip, ProgressBar, Spinner, Table } from "@heroui/react";
import Image from "next/image";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";
import { analyzeImageFile } from "@/lib/image-forensics/api";
import { createClientReportId, persistHistoryEntry } from "@/lib/history-client";
import {
  formatFixed,
  getSignalAgreementConfidence,
  getVerdictFromUnifiedResult,
  toPercent,
} from "@/lib/image-forensics/presentation";
import type { Layer1Output } from "@/lib/image-forensics/types";
import { useLoadingMessages } from "@/hooks/use-loading-messages";

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

// ─── Tone → color mapping for the PDF ────────────────────────────────────────
function toneToColor(tone: CardTone): { bg: string; text: string; border: string } {
  if (tone === "success") return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" };
  if (tone === "warning") return { bg: "#fffbeb", text: "#b45309", border: "#fde68a" };
  return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
}

// ─── Build the hidden HTML report element ────────────────────────────────────
function buildReportHTML(
  result: Layer1Output,
  signalCards: SignalCard[],
  previewUrl: string,
  verdict: { label: string; tone: CardTone; summary: string } | null,
  reportId: string,
): string {
  const scorePercent = toPercent(result.authenticity_score);
  const aiRiskPercent = 100 - scorePercent;
  const confidencePercent = toPercent(getSignalAgreementConfidence(result));
  const verdictTone = verdict?.tone ?? "warning";

  const meterColor =
    verdictTone === "success" ? "#16a34a" : verdictTone === "warning" ? "#d97706" : "#dc2626";

  const signalRows = signalCards
    .map((s) => {
      const c = toneToColor(s.tone);
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:13px;color:#475569;font-weight:500;">${s.label}</span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
          padding:3px 10px;border-radius:999px;
          background:${c.bg};color:${c.text};border:1px solid ${c.border};">
          ${s.status}
        </span>
      </div>`;
    })
    .join("");

  const tableRows = [
    ["Verdict", result.verdict ?? "-"],
    ["Authenticity Score", formatFixed(result.authenticity_score, 4)],
    ["Layer1 Score", formatFixed(result.layer1_score, 4)],
    ["Signal Confidence", `${confidencePercent}%`],
    ["EXIF Score", formatFixed(result.metadata.exif_score, 4)],
    ["Steg Score", formatFixed(result.steganography.steg_score, 4)],
    ["PRNU Score", formatFixed(result.prnu.prnu_score, 4)],
    ["Noise Variance", formatFixed(result.prnu.noise_variance, 6)],
    ["Spatial Correlation", formatFixed(result.prnu.spatial_correlation, 6)],
    ["ML Model", result.ml_prediction?.model ?? "-"],
    ["ML Label", result.ml_prediction?.label ?? "-"],
    ["ML Confidence", result.ml_prediction ? `${toPercent(result.ml_prediction.confidence)}%` : "-"],
    ["C2PA Score", formatFixed(result.c2pa.c2pa_score, 4)],
    ["C2PA Note", result.c2pa.note ?? "-"],
    [
      "Physics Violations",
      result.metadata.physics_violations.length > 0
        ? result.metadata.physics_violations.join(", ")
        : "None detected",
    ],
  ]
    .map(
      ([field, value], i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};">
      <td style="padding:9px 14px;font-size:12px;color:#64748b;font-weight:500;border-bottom:1px solid #e2e8f0;width:40%;">${field}</td>
      <td style="padding:9px 14px;font-size:12px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${value}</td>
    </tr>`,
    )
    .join("");

  const now = new Date().toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #fff;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.55;
    }

    /* ── HEADER ── */
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%);
      padding: 32px 40px 28px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
    .header-left h1 {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }
    .header-left p {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin-top: 4px;
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 10px 16px;
      margin-top: 6px;
    }
    .header-badge .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: ${meterColor};
    }
    .header-badge .label {
      font-size: 13px;
      font-weight: 700;
      color: ${meterColor};
      letter-spacing: 0.3px;
    }
    .header-right { text-align: right; }
    .header-right .ts { font-size: 11px; color: rgba(255,255,255,0.4); }
    .header-right .ts strong { color: rgba(255,255,255,0.7); display: block; }

    /* ── BODY ── */
    .body { padding: 36px 40px; }

    /* ── SCORE HERO ── */
    .score-hero {
      display: flex;
      gap: 32px;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 32px;
    }
    .score-circle {
      position: relative;
      width: 110px;
      height: 110px;
      flex-shrink: 0;
    }
    .score-circle svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    .score-value {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }
    .score-value small { font-size: 11px; font-weight: 500; color: #94a3b8; margin-top: 2px; }
    .score-details { flex: 1; }
    .score-details .verdict-label {
      font-size: 20px;
      font-weight: 700;
      color: ${meterColor};
      margin-bottom: 6px;
    }
    .score-details .summary { font-size: 13px; color: #64748b; margin-bottom: 14px; line-height: 1.6; }
    .score-meta { display: flex; gap: 24px; flex-wrap: wrap; }
    .score-meta-item { }
    .score-meta-item .smk { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
    .score-meta-item .smv { font-size: 15px; font-weight: 700; color: #1e293b; }

    /* ── TWO COLUMN ── */
    .two-col { display: flex; gap: 24px; margin-bottom: 28px; }
    .two-col > * { flex: 1; }

    /* ── PREVIEW CARD ── */
    .preview-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .preview-card .preview-img {
      width: 100%;
      height: 220px;
      object-fit: contain;
      background: #f1f5f9;
      display: block;
    }
    .preview-card .preview-footer {
      padding: 10px 14px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }

    /* ── SIGNAL CARD ── */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .signals-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 18px;
      background: #fff;
    }

    /* ── ML CARD ── */
    .ml-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 18px;
      background: #fff;
      margin-top: 16px;
    }
    .ml-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .ml-row:last-child { border-bottom: none; }
    .ml-row .mk { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .ml-row .mv { font-size: 13px; font-weight: 600; color: #0f172a; }

    /* ── TABLE ── */
    .breakdown-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      font-size: 12px;
    }

    /* ── FOOTER ── */
    .report-footer {
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .report-footer .brand { font-weight: 700; color: #475569; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>MediaForensics</h1>
      <p>Autonomous Image Authenticity Report</p>
      <div class="header-badge">
        <div class="dot"></div>
        <span class="label">${verdict?.label ?? "Analysis Complete"}</span>
      </div>
    </div>
    <div class="header-right">
      <div class="ts"><strong>Report Generated</strong>${now}</div>
      <div style="margin-top:8px;" class="ts"><strong>Report ID</strong>${reportId}</div>
      <div style="margin-top:8px;" class="ts"><strong>Pipeline</strong>EXIF · Steg · PRNU · C2PA · EfficientNet</div>
    </div>
  </div>

  <div class="body">

    <!-- SCORE HERO -->
    <div class="score-hero">
      <div class="score-circle">
        <svg viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="55" cy="55" r="46" stroke="#e2e8f0" stroke-width="9" fill="none"/>
          <circle cx="55" cy="55" r="46" stroke="${meterColor}" stroke-width="9" fill="none"
            stroke-dasharray="${Math.round(2 * Math.PI * 46)}"
            stroke-dashoffset="${Math.round(2 * Math.PI * 46 * (1 - scorePercent / 100))}"
            stroke-linecap="round"/>
        </svg>
        <div class="score-value">
          ${scorePercent}%
          <small>Auth.</small>
        </div>
      </div>
      <div class="score-details">
        <div class="verdict-label">${verdict?.label ?? "Analysis Complete"}</div>
        <div class="summary">${verdict?.summary ?? ""}</div>
        <div class="score-meta">
          <div class="score-meta-item">
            <div class="smk">Signal Confidence</div>
            <div class="smv">${confidencePercent}%</div>
          </div>
          <div class="score-meta-item">
            <div class="smk">AI/Tamper Risk</div>
            <div class="smv">${aiRiskPercent}%</div>
          </div>
          <div class="score-meta-item">
            <div class="smk">Processing Time</div>
            <div class="smv">${formatDuration(result.processing_ms)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TWO COLUMN -->
    <div class="two-col">
      <!-- Preview -->
      <div>
        <div class="section-title">Analyzed Image</div>
        <div class="preview-card">
          <img class="preview-img" src="${previewUrl}" alt="Analyzed image" crossorigin="anonymous" />
          <div class="preview-footer">
            <span>${result.metadata.exif_consistent ? "✓ Metadata Consistent" : "⚠ Metadata Warning"}</span>
            <span>PRNU ${toPercent(result.prnu.prnu_score)}% match</span>
          </div>
        </div>
      </div>

      <!-- Signals + ML -->
      <div>
        <div class="section-title">Forensic Signals</div>
        <div class="signals-card">
          ${signalRows}
        </div>

        <div class="ml-card">
          <div class="section-title" style="margin-bottom:4px;">AI Model Analysis</div>
          <div class="ml-row">
            <span class="mk">Model</span>
            <span class="mv">${result.ml_prediction?.model ?? "Standard Model"}</span>
          </div>
          <div class="ml-row">
            <span class="mk">Classification</span>
            <span class="mv" style="color:${result.ml_prediction?.label === "Real" ? "#16a34a" : "#dc2626"};">
              ${result.ml_prediction?.label ?? "Unknown"}
            </span>
          </div>
          <div class="ml-row">
            <span class="mk">Confidence</span>
            <span class="mv">${result.ml_prediction ? `${toPercent(result.ml_prediction.confidence)}%` : "-"}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- DETAILED BREAKDOWN -->
    <div class="breakdown-title">Full Forensic Breakdown</div>
    <table>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- FOOTER -->
    <div class="report-footer">
      <span class="brand">MediaForensics</span>
      <span>This report is generated automatically. Results should be interpreted by a qualified analyst.</span>
      <span>Confidential</span>
    </div>

  </div>
</body>
</html>
  `;
}

// ─── PDF Generation using html2canvas + jsPDF ────────────────────────────────
async function downloadReportAsPDF(
  result: Layer1Output,
  signalCards: SignalCard[],
  previewUrl: string,
  verdict: { label: string; tone: CardTone; summary: string } | null,
  reportId: string,
) {
  // Dynamically import to avoid SSR issues
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const html = buildReportHTML(result, signalCards, previewUrl, verdict, reportId);

  // Render into a hidden iframe so styles don't bleed
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:960px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images to load inside iframe
  await new Promise<void>((resolve) => {
    const imgs = doc.querySelectorAll("img");
    if (imgs.length === 0) return resolve();
    let loaded = 0;
    imgs.forEach((img) => {
      if (img.complete) {
        loaded++;
        if (loaded === imgs.length) resolve();
      } else {
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === imgs.length) resolve();
        };
      }
    });
    // Fallback timeout
    setTimeout(resolve, 3000);
  });

  // Expand iframe to full content height
  const body = doc.body;
  iframe.style.height = `${body.scrollHeight + 40}px`;

  await new Promise((r) => setTimeout(r, 200)); // let layout settle

  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: 960,
    windowWidth: 960,
  });

  document.body.removeChild(iframe);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let yOffset = 0;
  let remaining = imgHeight;

  while (remaining > 0) {
    const slice = Math.min(remaining, pageHeight);
    const srcY = (yOffset / imgHeight) * canvas.height;
    const srcH = (slice / imgHeight) * canvas.height;

    // Crop canvas slice
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = srcH;
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);

    if (yOffset > 0) pdf.addPage();
    pdf.addImage(sliceData, "JPEG", 0, 0, imgWidth, slice);

    yOffset += slice;
    remaining -= slice;
  }

  const date = new Date().toISOString().slice(0, 10);
  const safeVerdict = verdict?.label.replace(/\s+/g, "_") ?? "Report";
  pdf.save(`MediaForensics_image_${safeVerdict}_${reportId}_${date}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImageForensicsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [reportId, setReportId] = useState<string>("");
  const [result, setResult] = useState<Layer1Output | null>(null);
  const loadingMessage = useLoadingMessages(isLoading);

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
    const prnuScore = result.prnu.prnu_score;
    const prnuTone: CardTone = prnuScore >= 0.65 ? "success" : prnuScore >= 0.4 ? "warning" : "danger";

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

  const handleUploadClick = () => fileInputRef.current?.click();

  const processFile = async (file: File, inputElement?: HTMLInputElement) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload a valid image file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setErrorMessage("");
    setIsLoading(true);
    setSelectedFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setReportId("");
    setResult(null);
    try {
      const payload = await analyzeImageFile(file);
      const nextReportId = payload.request_id || createClientReportId("image");
      setResult(payload);
      setReportId(nextReportId);

      void persistHistoryEntry({
        media_type: "image",
        verdict: payload.verdict,
        confidence: payload.authenticity_score,
        request_id: nextReportId,
        result: payload,
      }).catch(() => {
        // Non-fatal: history persistence is best-effort in dev
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Image analysis failed");
    } finally {
      setIsLoading(false);
      if (inputElement) inputElement.value = "";
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file, event.target);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDownloadPDF = async () => {
    if (!result || !reportId) return;
    setIsPdfGenerating(true);
    try {
      await downloadReportAsPDF(result, signalCards, previewUrl, verdict, reportId);
    } finally {
      setIsPdfGenerating(false);
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
            {result && !isLoading && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/5 !text-white hover:bg-white/10 disabled:opacity-60"
                  onPress={handleDownloadPDF}
                  isDisabled={isPdfGenerating}
                >
                  {isPdfGenerating ? (
                    <>
                      <Spinner size="sm" color="current" className="mr-2" />
                      Generating PDF…
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download PDF Report
                    </>
                  )}
                </Button>
              </div>
            )}
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={40}>
          <section className="mb-20">
            <Card
              className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center sm:p-8 md:p-10 transition-colors hover:border-white/40"
              variant="secondary"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Card.Header className="items-center gap-3">
                <Card.Title className="text-xl text-white sm:text-2xl">
                  Drag &amp; Drop the Image
                </Card.Title>
                <Card.Description className="text-white/60">
                  Supported formats: PNG, JPG, TIFF, WEBP
                </Card.Description>
              </Card.Header>
              <Card.Footer className="mt-3 flex-col gap-3 sm:flex-row sm:justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="lg"
                  className="rounded-full px-10"
                  onPress={handleUploadClick}
                  isDisabled={isLoading}
                >
                  {isLoading ? loadingMessage : "Upload Image"}
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
                      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-6 py-4 text-center text-white">
                        <Spinner size="md" color="accent" />
                        <span className="text-sm font-medium">{loadingMessage}</span>
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
                      {result ? `${aiRiskPercent}%` : "--"}
                    </div>
                    <ProgressBar
                      aria-label="Image authenticity score"
                      value={result ? aiRiskPercent : 0}
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
                      Unified AI/Tamper Risk (Forensics + ML)
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
                      <>
                        <p className="mt-1 text-xs text-white/70">
                          Authenticity: {scorePercent}%
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-white/45">
                          Report ID: {reportId}
                        </p>
                      </>
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
                <Card.Title className="text-sm uppercase tracking-[0.16em] text-white/60">
                  AI Model Analysis
                </Card.Title>
                <Card.Content className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.16em] text-white/45">Model</span>
                    <span className="text-sm text-white">
                      {result?.ml_prediction?.model || "Standard Model"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.16em] text-white/45">Label</span>
                    <Chip
                      color={
                        result
                          ? result.ml_prediction?.label === "Real"
                            ? "success"
                            : "danger"
                          : "warning"
                      }
                      size="sm"
                      variant="soft"
                    >
                      {result ? result.ml_prediction?.label || "Unknown" : "Pending"}
                    </Chip>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.16em] text-white/45">
                      Confidence
                    </span>
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
              <Card.Title className="mb-4 font-headline text-3xl italic text-white">
                Forensic Breakdown
              </Card.Title>
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
                        <Table.Cell>
                          {result ? formatFixed(result.steganography.steg_score, 4) : "-"}
                        </Table.Cell>
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
                        <Table.Cell>
                          {result ? formatFixed(result.prnu.spatial_correlation, 6) : "-"}
                        </Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>ML Label</Table.Cell>
                        <Table.Cell>{result ? result.ml_prediction?.label || "-" : "-"}</Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>ML Confidence</Table.Cell>
                        <Table.Cell>
                          {result?.ml_prediction
                            ? `${toPercent(result.ml_prediction.confidence)}%`
                            : "-"}
                        </Table.Cell>
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
