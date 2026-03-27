"use client";

import { useState, useEffect } from "react";

const defaultAnalysisMessages = [
  "Initializing forensic engine...",
  "Extracting signal features...",
  "Running deepfake detection models...",
  "Analyzing noise patterns (PRNU)...",
  "Checking for compression artifacts...",
  "Verifying geometric consistency...",
  "Scanning for generative AI markers...",
  "Finalizing authenticity report..."
];

export function useLoadingMessages(isLoading: boolean, messages: string[] = defaultAnalysisMessages) {
  const activeMessages = messages.length > 0 ? messages : defaultAnalysisMessages;
  const [message, setMessage] = useState(activeMessages[0]);

  useEffect(() => {
    if (!isLoading) return;

    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % activeMessages.length;
      setMessage(activeMessages[index]);
    }, 2500);

    return () => clearInterval(interval);
  }, [activeMessages, isLoading]);

  return isLoading ? message : activeMessages[0];
}
