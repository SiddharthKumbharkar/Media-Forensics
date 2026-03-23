import type { Metadata } from "next";
import { Barlow, Instrument_Serif } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-body",
  weight: ["300", "400", "600"],
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-headline",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediaForensics",
  description: "Zero-trust media verification for video, image, and audio analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${instrumentSerif.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-black font-body text-white">{children}</body>
    </html>
  );
}
