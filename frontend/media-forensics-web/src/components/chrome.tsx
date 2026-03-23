"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { Button, Link, Surface } from "@heroui/react";
import { FooterStreamVideo } from "@/components/footer-stream-video";

type NavKey = "home" | "video" | "image" | "audio";

const navItems: Array<{ href: string; key: NavKey; label: string }> = [
  { key: "home", href: "/", label: "Home" },
  { key: "video", href: "/video-forensics", label: "Video" },
  { key: "image", href: "/image-forensics", label: "Image" },
  { key: "audio", href: "/audio-forensics", label: "Audio" },
];

export function TopNav({ active, overlay = false }: { active: NavKey; overlay?: boolean }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <>
      {isMenuOpen ? (
        <button
          type="button"
          aria-label="Close mobile navigation"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}

      <header
        className={`fixed left-0 right-0 top-0 z-50 mx-auto mt-3 flex w-full max-w-5xl flex-col px-3 sm:mt-4 sm:px-4 ${
          overlay ? "" : ""
        }`}
      >
        <Surface
          className="flex w-full items-center justify-between rounded-full border border-white/20 bg-white/5 px-4 py-2.5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:px-6"
          variant="transparent"
        >
          <div className="flex items-center gap-2">
            <span className="font-headline text-lg font-semibold italic tracking-tight text-white sm:text-xl">
              MediaForensics
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.key}
                className={`text-sm font-semibold no-underline !opacity-100 hover:!text-white ${
                  item.key === active ? "!text-white" : "!text-white/80"
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <NextLink href="/run" className="hidden md:inline-flex">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-white/30 bg-white/5 !text-white hover:bg-white/10"
              >
                Get Started
              </Button>
            </NextLink>

            <Button
              isIconOnly
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMenuOpen}
              variant="outline"
              className="rounded-full border-white/30 bg-white/5 !text-white hover:bg-white/10 md:hidden"
              onPress={() => setIsMenuOpen((prev) => !prev)}
            >
              {isMenuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-5"
                >
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-5"
                >
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              )}
            </Button>
          </div>
        </Surface>

        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${
            isMenuOpen ? "mt-2 max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <Surface className="rounded-3xl border border-white/15 bg-black/65 p-3 backdrop-blur-2xl" variant="transparent">
            <nav className="grid gap-2">
              {navItems.map((item) => (
                <NextLink
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    item.key === active
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </NextLink>
              ))}
            </nav>

            <NextLink href="/run" className="mt-3 block" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full rounded-full" variant="outline">
                Get Started
              </Button>
            </NextLink>
          </Surface>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-10 min-h-[240px] w-full overflow-hidden border-t border-white/10 px-3 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-10 sm:px-4 md:px-6">
      <FooterStreamVideo />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 flex w-full flex-col items-center justify-between gap-6 md:flex-row">
        <span className="font-headline text-lg font-semibold italic tracking-tight text-white sm:text-xl">
              MediaForensics
            </span>
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs uppercase tracking-widest text-white/70">
          <a href="#" className="transition-colors hover:text-white">
            API Docs
          </a>
          <a href="#" className="transition-colors hover:text-white">
            Privacy
          </a>
          <a href="#" className="transition-colors hover:text-white">
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}
