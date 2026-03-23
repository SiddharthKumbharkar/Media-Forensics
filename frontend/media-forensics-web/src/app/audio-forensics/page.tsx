"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Avatar, Button, Card, Chip, ProgressBar } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";

const waveHeights = [8, 14, 26, 18, 34, 22, 40, 34, 42, 30, 38, 22, 26, 14, 10, 18, 32, 24, 36, 28, 34, 20];
const analysisDurationSec = 42.15;

const layerCards = [
  {
    title: "ENF Layer",
    status: "MISMATCH",
    score: 22,
    confidence: 87,
    detail: "Grid frequency signature conflicts with declared capture region.",
    color: "danger",
  },
  {
    title: "Prosody Layer",
    status: "MINOR",
    score: 61,
    confidence: 74,
    detail: "Cadence variance appears mildly compressed in voiced sections.",
    color: "warning",
  },
  {
    title: "Glottal Layer",
    status: "CRITICAL",
    score: 18,
    confidence: 91,
    detail: "Pulse-shape markers deviate from natural phonation envelopes.",
    color: "danger",
  },
  {
    title: "Room Layer",
    status: "INCONSISTENT",
    score: 34,
    confidence: 79,
    detail: "RT60 profile shifts suggest concatenated acoustic environments.",
    color: "warning",
  },
] as const;

const explainabilityData = {
  all_flags: [
    "enf_splice_discontinuity_detected",
    "inconsistent_room_acoustics",
    "missing_early_reflections",
  ],
  all_anomalies: [
    "Oq out of range: 0.24",
    "Asymmetry out of range: 5.41",
    "Jitter too low: 0.09%",
    "Syllable rhythm too regular (CV: 0.18)",
  ],
  splice_locations_sec: [18.2, 24.5],
};

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.max(0, Math.floor(totalSeconds % 60));

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function AudioForensicsPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [playbackTime, setPlaybackTime] = useState(14);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const timelineEvents = useMemo(() => {
    const splices = explainabilityData.splice_locations_sec.map((sec, idx) => ({
      id: `splice-${idx}`,
      kind: "splice" as const,
      label: `Splice detected @ ${formatTime(sec)}`,
      sec,
    }));

    const anomalies = explainabilityData.all_anomalies.map((item, idx) => ({
      id: `anomaly-${idx}`,
      kind: "anomaly" as const,
      label: item,
      sec: Math.min(analysisDurationSec - 1, 7 + idx * 6.5),
    }));

    return [...splices, ...anomalies].sort((a, b) => a.sec - b.sec);
  }, []);

  const seekToEvent = (eventId: string, sec: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = sec;
    setPlaybackTime(sec);
    setSelectedEvent(eventId);
  };

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleAudioPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    const nextUrl = URL.createObjectURL(file);
    setAudioUrl(nextUrl);
    setPlaybackTime(0);
    setSelectedEvent(null);
  };

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
            <Card className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center sm:p-8 md:p-10" variant="secondary">
              <Card.Header className="items-center gap-3">
                <Card.Title className="text-xl text-white sm:text-2xl">Drag &amp; Drop the audio</Card.Title>
                <Card.Description className="text-white/60">Supported formats: MP3, WAV, FLAC, AAC</Card.Description>
              </Card.Header>
              <Card.Footer className="justify-center">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleAudioPick}
                  />
                  <Button size="lg" className="rounded-full px-10" onPress={handleUploadClick}>
                  Upload Audio
                </Button>
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
                  <Card.Title className="text-lg text-white">Deep synthesis detection active</Card.Title>
                </div>
                <div className="flex gap-2">
                  <Chip color="danger" size="sm" variant="soft">Detected AI</Chip>
                  <Chip size="sm" variant="secondary">Natural</Chip>
                </div>
              </Card.Header>
              <Card.Content className="flex h-full flex-col justify-between">
                <div className="mt-6 flex h-52 items-center justify-between gap-1">
                  {waveHeights.map((height, idx) => (
                    <div
                      key={`${height}-${idx}`}
                      style={{ height: `${height * 3}px` }}
                      className={
                        idx >= 6 && idx <= 10
                          ? "w-1 rounded-full bg-danger shadow-[0_0_12px_rgba(255,90,90,.45)]"
                          : "w-1 rounded-full bg-white/35"
                      }
                    />
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
                  <span>
                    {formatTime(playbackTime)} / {formatTime(analysisDurationSec)}
                  </span>
                  <span>Anomaly cluster: 00:18 — 00:24</span>
                </div>
              </Card.Content>
            </Card>

            <Card className="border border-white/10 p-6" variant="secondary">
              <Card.Header className="items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Timeline-to-Playback
                  </Card.Description>
                  <Card.Title className="text-lg text-white">Click events to seek audio playback</Card.Title>
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
                  onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
                />

                {!audioUrl ? (
                  <p className="text-xs text-white/50">
                    Upload an audio file to enable real playback seek. Timeline interactions are already active.
                  </p>
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
                            event.kind === "splice" ? "border-danger bg-danger/80" : "border-warning bg-warning/80"
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
                          <span className="ml-3 text-xs uppercase tracking-[0.14em] text-white/50">
                            {formatTime(event.sec)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.16em] text-white/45">Splice Windows</p>
                    <div className="space-y-2">
                      {explainabilityData.splice_locations_sec.map((sec, idx) => (
                        <button
                          key={`splice-window-${idx}`}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-left text-sm text-danger"
                          onClick={() => seekToEvent(`splice-${idx}`, sec)}
                        >
                          <span>Splice #{idx + 1}</span>
                          <span className="text-xs uppercase tracking-[0.14em]">{formatTime(sec)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </div>

          <div className="space-y-6 xl:col-span-6 xl:sticky xl:top-28 xl:self-start">
            <Card className="border border-white/10 p-8 text-center xl:h-[420px]" variant="secondary">
              <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                Authenticity Score
              </Card.Description>
              <Card.Content className="mt-6 flex h-full flex-col items-center justify-between gap-6">
                <div className="w-full max-w-[240px]">
                  <div className="text-5xl font-semibold tracking-tight text-white">28%</div>
                  <ProgressBar aria-label="Audio authenticity score" value={28} size="sm" color="danger" className="mt-3 w-full">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </div>
                <Chip color="danger" variant="soft">Deepfake Detected</Chip>
                <div className="w-full space-y-2 text-left text-sm text-white/65">
                  <div className="flex justify-between"><span>Confidence</span><span>98.4%</span></div>
                  <div className="flex justify-between"><span>Latency</span><span>1.2s</span></div>
                  <div className="flex justify-between"><span>Sample Rate</span><span>48.0kHz</span></div>
                </div>
                <Button className="mt-3 w-full rounded-full" variant="outline">
                  Generate Forensic Report
                </Button>
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
                  {explainabilityData.all_flags.length + explainabilityData.all_anomalies.length} findings
                </Chip>
              </Card.Header>
              <Card.Content className="space-y-5">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">all_flags</p>
                  <div className="flex flex-wrap gap-2">
                    {explainabilityData.all_flags.map((flag) => (
                      <Chip key={flag} color="danger" size="sm" variant="soft">
                        {flag}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/45">all_anomalies</p>
                  <div className="space-y-2">
                    {explainabilityData.all_anomalies.map((anomaly) => (
                      <div key={anomaly} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/70">
                        {anomaly}
                      </div>
                    ))}
                  </div>
                </div>
              </Card.Content>
            </Card>

          </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {layerCards.map((layer) => (
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

        <ScrollReveal delayMs={100}>
          <section className="mx-auto mt-8 w-full max-w-xl">
            <Card className="border border-white/10 p-5" variant="secondary">
              <Card.Content className="flex items-start gap-3">
                <Avatar>
                  <Avatar.Image alt="Forensic analyst" src="https://img.heroui.chat/image/avatar?w=120&h=120&u=47" />
                  <Avatar.Fallback>AT</Avatar.Fallback>
                </Avatar>
                <div>
                  <p className="text-xs italic text-white/60">
                    “Synthesized phoneme transitions around the 18-second segment are a hallmark of
                    v2 voice generators.”
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-widest text-white/45">
                    — Dr. Aris Thorne, Forensic Lead
                  </p>
                </div>
              </Card.Content>
            </Card>
          </section>
        </ScrollReveal>
      </main>

      <SiteFooter />
    </>
  );
}
