"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { TopNav, SiteFooter } from "@/components/chrome";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught by Next.js Error Boundary:", error);
  }, [error]);

  return (
    <>
      <div className="grain-overlay" />
      <TopNav active="home" overlay />
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <h2 className="mb-4 font-headline text-4xl text-white italic">Something went wrong</h2>
        <p className="mb-8 text-white/60 max-w-md">
          A rendering error interrupted the forensic workflow. You can retry this view or jump back to a stable page.
        </p>
        {error.digest ? (
          <p className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs text-white/45">
            Error digest: {error.digest}
          </p>
        ) : null}
        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" size="lg" className="rounded-full border-danger text-danger bg-danger/10 sm:flex-1" onPress={() => reset()}>
            Attempt Recovery
          </Button>
          <Link href="/history" className="sm:flex-1">
            <Button variant="secondary" size="lg" className="w-full rounded-full border-white/20 bg-white/10 text-white">
              Open History
            </Button>
          </Link>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
