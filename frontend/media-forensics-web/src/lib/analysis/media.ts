import type { MediaType } from "@/lib/analysis/types";

export interface MediaConfig {
  title: string;
  description: string;
  uploadLabel: string;
  supportedFormatsLabel: string;
  accept: string;
  extensions: Set<string>;
  validationMimePrefixes: string[];
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"]);
const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".mp4", ".mov", ".avi", ".mkv", ".webm"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".avi", ".mkv", ".webm"]);

export const MEDIA_CONFIG: Record<MediaType, MediaConfig> = {
  image: {
    title: "Analyze Image Authenticity",
    description: "Upload an image and receive a normalized AI risk assessment without exposing engine details to the client.",
    uploadLabel: "Upload Image",
    supportedFormatsLabel: "Supported formats: PNG, JPG, JPEG, WEBP, BMP, GIF, TIFF",
    accept: "image/*",
    extensions: IMAGE_EXTENSIONS,
    validationMimePrefixes: ["image/"],
  },
  audio: {
    title: "Analyze Audio Authenticity",
    description: "Upload audio or an audio-bearing container and receive a single risk score, confidence value, and verdict.",
    uploadLabel: "Upload Audio",
    supportedFormatsLabel: "Supported formats: WAV, MP3, FLAC, OGG, M4A, AAC, MP4, MOV, AVI, MKV, WEBM",
    accept: "audio/*,video/*",
    extensions: AUDIO_EXTENSIONS,
    validationMimePrefixes: ["audio/", "video/"],
  },
  video: {
    title: "Analyze Video Authenticity",
    description: "Upload a video and receive a unified result from the active analysis engine configuration.",
    uploadLabel: "Upload Video",
    supportedFormatsLabel: "Supported formats: MP4, M4V, MOV, AVI, MKV, WEBM",
    accept: "video/mp4,video/x-m4v,video/quicktime,video/x-msvideo,video/x-matroska,video/webm",
    extensions: VIDEO_EXTENSIONS,
    validationMimePrefixes: ["video/"],
  },
};

export function getMediaConfig(mediaType: MediaType): MediaConfig {
  return MEDIA_CONFIG[mediaType];
}

export function getFileExtension(filename: string | undefined): string {
  if (!filename) return "";
  const separatorIndex = filename.lastIndexOf(".");
  return separatorIndex >= 0 ? filename.slice(separatorIndex).toLowerCase() : "";
}

export function isAllowedMediaFile(mediaType: MediaType, file: File): boolean {
  const config = MEDIA_CONFIG[mediaType];
  if (config.validationMimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    return true;
  }

  return config.extensions.has(getFileExtension(file.name));
}

export function detectMediaType(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";

  const extension = getFileExtension(file.name);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";

  return null;
}
