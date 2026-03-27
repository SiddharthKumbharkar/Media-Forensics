"use client";

import NextLink from "next/link";
import { Button, Card } from "@heroui/react";
import { SiteFooter, TopNav } from "@/components/chrome";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function NotFound() {
  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="home" />

      <main className="w-full px-3 sm:px-4 md:px-6">
        <ScrollReveal>
          <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center">
            <Card className="liquid-glass w-full border border-white/15 p-8 text-center sm:p-10 md:p-14" variant="secondary">
              <Card.Content className="space-y-6">

                <h1 className="font-headline italic leading-none tracking-tighter text-white selection:bg-white selection:text-black text-[6rem] sm:text-[8rem] md:text-[12rem]">
                  404
                </h1>

                <p className="mx-auto max-w-2xl text-base text-white/70 sm:text-lg">
                  The page you are looking for does not exist or may have been moved.
                </p>

                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <NextLink href="/">
                    <Button size="lg" className="rounded-full px-10" variant="outline">
                      Go Home
                    </Button>
                  </NextLink>
                  <NextLink href="/video-forensics">
                    <Button size="lg" className="rounded-full px-10" variant="outline">
                      Analyze Media
                    </Button>
                  </NextLink>
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
