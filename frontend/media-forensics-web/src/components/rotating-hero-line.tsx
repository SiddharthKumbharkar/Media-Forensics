"use client";

import { useEffect, useMemo, useState } from "react";

const PHRASES = ["Verify What You Don’t.", "MediaForensics"] as const;
const PRIMARY_LINE = "Trust What You See.";

export function RotatingHeroLine() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIsVisible(false);

      window.setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % PHRASES.length);
        setIsVisible(true);
      }, 260);
    }, 2800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const currentPhrase = useMemo(() => PHRASES[activeIndex], [activeIndex]);
  const isBrandLine = currentPhrase === "MediaForensics";

  return (
    <span className="relative inline-flex h-[2.6em] w-full items-center justify-center overflow-hidden align-middle">
      <span
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-300 ease-out ${
          !isBrandLine && isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <span className="inline-block">{PRIMARY_LINE}</span>
        <span className="inline-block">{PHRASES[0]}</span>
      </span>

      <span
        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
          isBrandLine && isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        } text-[1.42em]`}
      >
        {PHRASES[1]}
      </span>
    </span>
  );
}
