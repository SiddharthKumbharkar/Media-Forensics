import NextLink from "next/link";
import { Button, Card } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";

const analyzers = [
  {
    title: "Video Forensics",
    description: "Deepfake probability, model consensus, and timeline-level confidence mapping.",
    href: "/video-forensics",
  },
  {
    title: "Image Forensics",
    description: "Unified authenticity score from EXIF, C2PA, PRNU, steganography, and ML detection.",
    href: "/image-forensics",
  },
  {
    title: "Audio Forensics",
    description: "ENF, prosodic, glottal, and room-acoustic checks for speech authenticity.",
    href: "/audio-forensics",
  },
];

export default function RunPage() {
  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="home" />

      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
        <ScrollReveal>
          <section className="mb-12 text-center">
            <h1 className="mb-4 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
              Run Media Analysis
            </h1>
            <p className="mx-auto max-w-3xl text-base text-white/70 sm:text-lg">
              Choose a forensic pipeline and start analysis.
            </p>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={50}>
          <section className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
            {analyzers.map((item) => (
              <Card key={item.title} className="border border-white/10 p-6" variant="secondary">
                <Card.Title className="text-xl text-white">{item.title}</Card.Title>
                <Card.Content className="space-y-5 pt-3">
                  <p className="text-sm text-white/70">{item.description}</p>
                  <NextLink href={item.href}>
                    <Button className="rounded-full" variant="outline">
                      Open
                    </Button>
                  </NextLink>
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
