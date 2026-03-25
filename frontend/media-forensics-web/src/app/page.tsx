import NextLink from "next/link";
import { Button, Card, Chip } from "@heroui/react";
import BorderGlow from "@/components/border-glow";
import { SiteFooter, TopNav } from "@/components/chrome";
import { HeroBackgroundVideo } from "@/components/hero-background-video";
import { RotatingHeroLine } from "@/components/rotating-hero-line";
import { ScrollReveal } from "@/components/scroll-reveal";

const technologies = [
  {
    title: "Provenance Tracking",
    body: "Leverage C2PA signatures and tamper-evident metadata to verify source lineage.",
    tags: ["C2PA", "Metadata"],
  },
  {
    title: "Deepfake Models",
    body: "Integrated model inference now contributes to final authenticity scoring for image and video analysis.",
    tags: ["EfficientNet", "CNN", "Ensemble"],
  },
  {
    title: "Audio Forensics",
    body: "ENF and prosodic analysis expose cloned voices and synthetic editing seams.",
    tags: ["ENF", "Spectrogram"],
  },
  {
    title: "Cross-Modal Sync",
    body: "Correlate lip movement, waveform timing, and scene acoustics for coherence checks.",
    tags: ["Sync", "Biometric"],
  },
];

const landingCardGlowProps = {
  edgeSensitivity: 35,
  glowColor: "40 80 80",
  backgroundColor: "#000000",
  borderRadius: 28,
  glowRadius: 40,
  glowIntensity: 1.8,
  coneSpread: 25,
  animated: false,
  colors: ["#c084fc", "#f472b6", "#38bdf8"],
};

export default function HomePage() {
  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="home" overlay />

      <main className="w-full pb-24 pt-0">
        <ScrollReveal>
          <section className="relative mb-24 min-h-screen w-full overflow-hidden">
            <HeroBackgroundVideo />
            <div className="hero-glow absolute inset-0" />
            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 pb-10 pt-28 text-center sm:px-6 md:px-10 md:pt-24">
              <h1 className="text-glow mb-6 font-headline text-4xl italic leading-tight text-white sm:text-5xl md:text-7xl">
                <RotatingHeroLine />
              </h1>
              <p className="mx-auto mb-10 max-w-3xl text-base text-white/70 sm:text-lg md:text-xl">
                MediaForensics analyzes video, image, and audio with cryptographic provenance,
                forensic signal extraction, and AI-assisted anomaly detection.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <NextLink href="/run">
                  <Button
                    size="lg"
                    className="rounded-full border-white/30 bg-white/5 px-10 !text-white hover:bg-white/10"
                    variant="outline"
                  >
                    Analyze Now
                  </Button>
                </NextLink>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <section className="mb-24 px-3 sm:px-4 md:px-6">
            <h2 className="mb-10 text-center font-headline text-3xl italic text-white sm:text-4xl md:text-5xl">
              Forensic Pipeline
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                ["01", "Ingestion", "Encrypted upload for high-fidelity media and provenance payloads."],
                ["02", "Analysis", "Parallel C2PA, artifact, and cross-modal forensic processing."],
                ["03", "Verdict", "Weighted confidence score with explainable evidence breakdown."],
              ].map(([index, title, text]) => (
                <BorderGlow key={index} className="h-full" {...landingCardGlowProps}>
                  <Card className="liquid-glass h-full border border-white/10 p-8" variant="secondary">
                    <Card.Header className="gap-1">
                      <Card.Description className="text-xs uppercase tracking-wider text-white/50">
                        {`${index} · ${title}`}
                      </Card.Description>
                      <Card.Title className="text-2xl text-white">{title}</Card.Title>
                    </Card.Header>
                    <Card.Content>
                      <p className="text-white/70">{text}</p>
                    </Card.Content>
                  </Card>
                </BorderGlow>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <section className="mb-24 px-3 sm:px-4 md:px-6">
            <h2 className="mb-3 font-headline text-4xl italic text-white sm:text-5xl">Scientific Precision.</h2>
            <p className="mb-10 max-w-2xl text-white/70">
              Institutional-grade methods built for journalists, investigators, and high-risk trust
              workflows.
            </p>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {technologies.map((item) => (
                <BorderGlow key={item.title} className="h-full" {...landingCardGlowProps}>
                  <Card className="liquid-glass h-full border border-white/10 p-6" variant="secondary">
                    <Card.Header className="gap-2">
                      <Card.Title className="text-xl text-white">{item.title}</Card.Title>
                    </Card.Header>
                    <Card.Content className="space-y-4">
                      <p className="text-sm text-white/70">{item.body}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <Chip key={tag} size="sm" variant="secondary">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    </Card.Content>
                  </Card>
                </BorderGlow>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={100}>
          <section className="mx-3 grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center sm:mx-4 md:mx-6 md:grid-cols-3">
            <div>
              <div className="font-headline text-5xl italic text-white">95%+</div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">Detection Accuracy</p>
            </div>
            <div>
              <div className="font-headline text-5xl italic text-white">3</div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">Layers of Verification</p>
            </div>
            <div>
              <div className="font-headline text-5xl italic text-white">Real-time</div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/50">Analysis Engine</p>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <SiteFooter />
    </>
  );
}
