## MediaForensics Web

This frontend routes every analysis request through a backend gateway. The browser never receives external service URLs, API keys, or vendor-specific response fields.

## Getting Started

1. Copy the environment template:

```bash
cp .env.example .env.local
```

2. Set the inference mode:

```bash
FORENSIC_MODE=internal
# valid values: internal | external | hybrid
```

3. Provide the internal and optional external endpoints in `.env.local`:

```bash
LAYER1_API_BASE_URL=http://127.0.0.1:8000
VIDEO_FORENSICS_API_BASE_URL=http://127.0.0.1:8001
EXTERNAL_INFERENCE_URL=https://isfake.ai/api/v0/public/detector
EXTERNAL_INFERENCE_KEY=your_api_key
EXTERNAL_INFERENCE_TIMEOUT_MS=30000
INTERNAL_ANALYSIS_TIMEOUT_MS=20000
```

The external base URL should point at the detector root. The backend appends `/image`, `/audio`, or `/video` automatically based on the uploaded media type.

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Inference Modes

- `internal`
  Routes media only to the existing internal services.
- `external`
  Routes media to the external inference client first and automatically falls back to internal analysis on failure.
- `hybrid`
  Runs both engines, fuses scores with `0.7 * external + 0.3 * internal`, and returns a normalized breakdown.

## Notes

- External provider requests default to 30 seconds and can be tuned with `EXTERNAL_INFERENCE_TIMEOUT_MS`. Set it to `0` to disable the external timeout entirely.
- Internal fallback requests can be tuned separately with `INTERNAL_ANALYSIS_TIMEOUT_MS` for slower model warm-up paths.
- Successful results are cached briefly in memory to reduce duplicate work.
- The unified backend response includes only normalized fields such as AI risk score, confidence, verdict, and an optional generic breakdown.
- External provider response fields like `is_fake_probability`, fragments, or heatmaps remain backend-only and are normalized before reaching the browser.

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
