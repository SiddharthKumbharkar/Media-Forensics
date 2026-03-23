import {
  Button,
  Card,
  Chip,
  ProgressBar,
  Table,
} from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function ImageForensicsPage() {
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
              <Button size="lg" className="rounded-full px-10">Upload Image</Button>
              <Button size="lg" className="rounded-full px-10" variant="outline">Enter URL</Button>
            </Card.Footer>
          </Card>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <section className="mb-16 grid gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <Card className="overflow-hidden border border-white/10" variant="secondary">
              <div className="relative aspect-video bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.12),transparent_45%),linear-gradient(145deg,#101010,#202020,#101010)]">
                <div className="absolute left-1/3 top-1/4 rounded-full border border-danger/50 bg-danger/15 px-3 py-1 text-xs uppercase tracking-wider text-danger">
                  Cloned Pixels
                </div>
                <div className="absolute bottom-1/3 right-1/4 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white">
                  AI Artifact
                </div>
              </div>
              <Card.Footer className="flex justify-between text-xs uppercase tracking-[0.16em] text-white/45">
                <span>Channel: Chrominance Diff</span>
                <span>Sensitivity: 98.4%</span>
              </Card.Footer>
            </Card>
          </div>

          <div className="space-y-5 lg:col-span-5">
            <Card className="border border-danger/30 p-6" variant="secondary">
              <Card.Content className="flex items-center gap-6">
                <div className="flex min-w-[130px] flex-col items-center gap-2">
                  <div className="text-4xl font-semibold tracking-tight text-white">68%</div>
                  <ProgressBar
                    aria-label="Image authenticity score"
                    value={68}
                    size="sm"
                    color="danger"
                    className="w-full"
                  >
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Authenticity Score</p>
                  <p className="text-3xl italic text-white">High Risk</p>
                  <p className="mt-2 text-xs text-white/60">
                    Significant structural anomalies found in high-frequency regions.
                  </p>
                </div>
              </Card.Content>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Pixel Continuity", "Fail", "danger"],
                ["GAN Artifacts", "Pass", "success"],
                ["Metadata", "Warn", "warning"],
                ["Compression", "Pass", "success"],
              ].map(([label, status, color]) => (
                <Card key={label} className="border border-white/10 p-4" variant="secondary">
                  <Card.Description className="text-xs uppercase tracking-[0.16em] text-white/45">
                    {label}
                  </Card.Description>
                  <Card.Content className="pt-3">
                    <Chip color={color as "danger" | "warning" | "success"} size="sm" variant="soft">
                      {status}
                    </Chip>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </div>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <section className="mb-20">
          <Card className="border border-white/10 p-6" variant="secondary">
            <Card.Title className="mb-4 font-headline text-3xl italic text-white">Camera Profile</Card.Title>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Camera profile">
                  <Table.Header>
                    <Table.Column isRowHeader>Field</Table.Column>
                    <Table.Column>Value</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell>Make</Table.Cell>
                      <Table.Cell>Unspecified</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Software</Table.Cell>
                      <Table.Cell>ImageMagick</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Created</Table.Cell>
                      <Table.Cell>2023-11-14</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell>Forensic Confidence</Table.Cell>
                      <Table.Cell>99.9%</Table.Cell>
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
