"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

const FOOTER_STREAM_URL =
  "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";

export function FooterStreamVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = FOOTER_STREAM_URL;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        capLevelToPlayerSize: true,
        enableWorker: true,
      });
      hls.loadSource(FOOTER_STREAM_URL);
      hls.attachMedia(video);
    }

    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay might be blocked until user interaction.
      }
    };

    void tryPlay();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
