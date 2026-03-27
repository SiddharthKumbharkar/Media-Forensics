import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased dark"
    >
      <body className="min-h-full bg-black font-body text-white">{children}</body>
    </html>
  );
}
