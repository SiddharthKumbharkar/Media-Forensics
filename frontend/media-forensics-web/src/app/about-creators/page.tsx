"use client";

import NextLink from "next/link";
import { Button, Card } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";
import BorderGlow from "@/components/border-glow";

const creators = [
  {
    name: "Sriram Kommalapudi",
    role: "Frontend, Integration & Deployment",
    bio: "Built the complete frontend experience, wired and integrated frontend with the entire backend stack, and deployed the full project live.",
    github: "https://github.com/StrungPattern-coder",
    linkedin: "https://www.linkedin.com/in/sriram-kommalapudi",
  },
  {
    name: "Naman Ostwal",
    role: "Audio Forensics Backend",
    bio: "Developed the complete backend for audio forensics, including the analysis pipeline and API integration for authenticity checks.",
    github: "https://github.com/NamanOstwal",
    linkedin: "https://www.linkedin.com/in/naman-ostwal-918894230",
  },
  {
    name: "Tanmay Sonjey",
    role: "Image Forensics Backend",
    bio: "Built the complete backend for image forensics, covering detection logic, scoring, and backend processing flow.",
    github: "https://github.com/Tanny-02",
    linkedin: "https://www.linkedin.com/in/tanmay-sonje-38b64222b",
  },
  {
    name: "Siddharth Kumbharkar",
    role: "Video Forensics Backend",
    bio: "Developed the complete backend for video forensics, including model pipeline orchestration and API-level inference flow.",
    github: "https://github.com/SiddharthKumbharkar",
    linkedin: "https://www.linkedin.com/in/siddharth-kumbharkar-01b9b4292",
  },
] as const;

const cardGlowProps = {
  edgeSensitivity: 30,
  glowColor: "60 100 120",
  backgroundColor: "#050505",
  borderRadius: 24,
  glowRadius: 40,
  glowIntensity: 1.2,
  coneSpread: 30,
  animated: true,
  colors: ["#38bdf8", "#818cf8", "#c084fc"],
};

export default function AboutCreatorsPage() {
  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="home" />

      <main className="w-full px-3 pb-24 pt-28 sm:px-4 md:px-6 md:pt-24">
        <ScrollReveal>
          <section className="mb-14 text-center">
            <h1 className="mb-5 font-headline text-3xl italic leading-tight text-white sm:text-4xl md:text-6xl">
              About the Creators
            </h1>
            <p className="mx-auto max-w-3xl text-base text-white/70 sm:text-lg">
              Meet the 4 builders behind MediaForensics. This platform was created to make media trust
              measurable using explainable forensic intelligence.
            </p>
          </section>
        </ScrollReveal>

        <ScrollReveal delayMs={60}>
          <section className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-2">
            {creators.map((creator, idx) => (
              <ScrollReveal key={creator.name} delayMs={100 + idx * 50}>
                <BorderGlow {...cardGlowProps}>
                  <Card className="liquid-glass h-full border border-white/10 p-6" variant="secondary">
                    <Card.Header className="flex-col items-start gap-1">
                      <Card.Title className="text-2xl font-headline italic text-white">
                        {creator.name}
                      </Card.Title>
                      <Card.Description className="text-xs uppercase tracking-widest text-sky-400">
                        {creator.role}
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="space-y-4 pt-3 text-sm text-white/75">
                      <p className="leading-relaxed">{creator.bio}</p>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <NextLink href={creator.github} target="_blank" rel="noopener noreferrer">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-full border-white/20 bg-white/5 hover:bg-white/10"
                          >
                            GitHub
                          </Button>
                        </NextLink>
                        <NextLink href={creator.linkedin} target="_blank" rel="noopener noreferrer">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-full border-white/20 bg-white/5 hover:bg-white/10"
                          >
                            LinkedIn
                          </Button>
                        </NextLink>
                      </div>
                    </Card.Content>
                  </Card>
                </BorderGlow>
              </ScrollReveal>
            ))}
          </section>
        </ScrollReveal>
      </main>

      <SiteFooter />
    </>
  );
}
