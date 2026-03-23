import { Button, Card, Chip, ProgressBar } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";

const timelineHeights = [80, 86, 78, 92, 80, 60, 95, 82, 88, 40, 85, 90, 98, 84, 80, 94, 86, 92];

export default function VideoForensicsPage() {
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
            <p className="mx-auto max-w-2xl text-base font-light text-white/70 sm:text-lg">
              Frame-level neural analysis and temporal consistency mapping detect synthetic
              manipulations with forensic precision.
            </p>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={40}>
          <section className="mb-20">
          <Card className="liquid-glass mx-auto w-full max-w-4xl border border-dashed border-white/20 p-6 text-center sm:p-8 md:p-10" variant="secondary">
            <Card.Header className="items-center gap-3">
              <Card.Title className="text-xl text-white sm:text-2xl">Drag &amp; drop the video</Card.Title>
              <Card.Description className="text-white/60">Supported formats: MP4, MOV, WEBM</Card.Description>
            </Card.Header>
            <Card.Footer className="justify-center">
              <Button className="rounded-full px-10" size="lg">
                Upload Video
              </Button>
            </Card.Footer>
          </Card>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <section className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <Card className="border border-white/10 p-8 text-center" variant="secondary">
              <Card.Description className="text-xs uppercase tracking-[0.2em] text-white/50">
                Authenticity Score
              </Card.Description>
              <Card.Content className="mt-5 flex flex-col items-center gap-4">
                <div className="text-6xl font-semibold tracking-tight text-white">98%</div>
                <ProgressBar aria-label="Authenticity score" value={98} size="sm" color="success" className="w-full max-w-[240px]">
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                <Chip color="success" variant="soft">
                  Authentic
                </Chip>
              </Card.Content>
            </Card>

            <Card className="border border-white/10 p-6" variant="secondary">
              <Card.Title className="text-sm uppercase tracking-[0.16em] text-white/60">
                Provenance Status
              </Card.Title>
              <Card.Content className="pt-4">
                <p className="font-semibold text-white">Valid Signature</p>
                <p className="text-sm text-white/65">Original source confirmed via trusted provenance chain.</p>
              </Card.Content>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-8">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Title className="text-xs uppercase tracking-widest text-white/50">Frame-level Anomalies</Card.Title>
                <Card.Content className="space-y-3 pt-4">
                  <p className="text-2xl font-light italic text-white">0.04% Detected</p>
                  <ProgressBar aria-label="Anomaly" value={4} size="sm" color="warning">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </Card.Content>
              </Card>

              <Card className="border border-white/10 p-6" variant="secondary">
                <Card.Title className="text-xs uppercase tracking-widest text-white/50">AI Likelihood</Card.Title>
                <Card.Content className="space-y-3 pt-4">
                  <p className="text-2xl font-light italic text-white">Negligible (2.1%)</p>
                  <ProgressBar aria-label="Likelihood" value={10} size="sm" color="success">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </Card.Content>
              </Card>
            </div>

            <Card className="border border-white/10 p-6" variant="secondary">
              <Card.Header className="items-start justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Temporal Consistency Map
                  </Card.Description>
                  <Card.Title className="text-xl italic text-white">Confidence across timeline</Card.Title>
                </div>
                <Chip size="sm" variant="secondary">Frame Seq-234</Chip>
              </Card.Header>
              <Card.Content>
                <div className="mt-6 flex h-52 items-end gap-1">
                  {timelineHeights.map((height, idx) => (
                    <div
                      key={`${height}-${idx}`}
                      className={idx === 9 ? "flex-1 rounded-t-sm bg-danger/50" : "flex-1 rounded-t-sm bg-white/25"}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex justify-between text-xs uppercase tracking-widest text-white/40">
                  <span>00:00:00</span>
                  <span>Playback duration 00:42:15</span>
                  <span>00:42:15</span>
                </div>
              </Card.Content>
            </Card>
          </div>
          </section>
        </ScrollReveal>
      </main>

      <SiteFooter />
    </>
  );
}
