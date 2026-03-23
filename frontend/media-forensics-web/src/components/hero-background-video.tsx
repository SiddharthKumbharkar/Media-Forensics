"use client";

import { useEffect, useRef } from "react";

const LANDING_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4";

export function HeroBackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const attemptPlayback = async () => {
      video.muted = true;
      video.volume = 1;

      try {
        await video.play();
      } catch {
        // Ignore if autoplay is fully blocked.
      }
    };

    void attemptPlayback();
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source src={LANDING_VIDEO_URL} type="video/mp4" />
      </video>

      <div className="absolute inset-0 z-10 bg-black/40" />
    </>
  );
}
