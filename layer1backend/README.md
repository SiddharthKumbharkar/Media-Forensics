# MediaForensics Backend — Layer 1 (Provenance + Physics)

This service is **Layer 1** of the MediaForensics pipeline.
It analyzes uploaded media frames/images using:
- EXIF physics checks
- Steganography checks (LSB + DCT heuristics)
- PRNU/noise pattern checks
- C2PA provenance verification (`c2patool`)

It returns a normalized JSON output that can be forwarded to **Layer 2** and then fused in Layer 3.

---

## 1) What this API does

**Endpoint:** `POST /analyze/image`

Input:
- One image file upload (`multipart/form-data`, field name = `file`)

Output:
- Structured Layer 1 JSON:
  - `metadata`
  - `steganography`
  - `prnu`
  - `layer1_score`

> Important: Field names are used downstream by fusion logic. Do not rename output fields without coordinating with Layer 3.

---

## 2) Local setup

From project folder:

```bash
cd /Volumes/Tanmay/MediaForensics/mediaforensics-backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn python-multipart pillow numpy scipy requests tensorflow==2.18.0
```

Install C2PA tool (macOS):

```bash
brew install c2patool
c2patool --version
```

---

## 3) Run Layer 1 API

```bash
cd /Volumes/Tanmay/MediaForensics/mediaforensics-backend
source .venv/bin/activate
uvicorn main:app --app-dir . --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

---

## 4) Score weights (runtime-configurable)

Layer 1 score is weighted at runtime via env vars:

- `LAYER1_W_EXIF`
- `LAYER1_W_STEG`
- `LAYER1_W_PRNU`
- `LAYER1_W_C2PA`

Example:

```bash
LAYER1_W_EXIF=0 LAYER1_W_STEG=0 LAYER1_W_PRNU=1 LAYER1_W_C2PA=0 \
uvicorn main:app --app-dir . --host 127.0.0.1 --port 8000
```

Weights are normalized internally to sum to 1.

---

## 5) Example request/response

Request:

```bash
curl -X POST http://127.0.0.1:8000/analyze/image \
  -F "file=@/absolute/path/to/frame.jpg"
```

Response (shape):

```json
{
  "metadata": {
    "exif_consistent": true,
    "physics_violations": [],
    "exif_score": 0.9
  },
  "steganography": {
    "lsb_anomaly": false,
    "dct_anomaly": false,
    "steg_score": 0.85
  },
  "prnu": {
    "noise_variance": 0.003,
    "spatial_correlation": 0.72,
    "prnu_score": 0.8
  },
  "layer1_score": 0.86
}
```

---

## 6) Frontend integration: Layer 1 → Layer 2

### Frontend call to Layer 1

```ts
const form = new FormData();
form.append("file", fileInput.files[0]);

const l1Res = await fetch("http://127.0.0.1:8000/analyze/image", {
  method: "POST",
  body: form,
});

if (!l1Res.ok) throw new Error(`Layer1 failed: ${await l1Res.text()}`);
const layer1 = await l1Res.json();
```

### Forward Layer 1 output to Layer 2

```ts
const l2Payload = {
  media_id: "your-media-id",
  layer1_output: layer1,
  // optionally include original media URL/metadata needed by Layer 2
};

const l2Res = await fetch("http://<layer2-host>/analyze/layer2", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(l2Payload),
});
```

Recommended contract between layers:
- Keep `layer1_output` as full JSON from Layer 1 (no field renaming)
- Add `media_id` for traceability
- Add `model_version` on Layer 2 side

---

## 7) Testing commands

### Calibration (best weights)

```bash
python tests/calibrate_layer1.py
```

### Evaluation (threshold and quality)

```bash
python tests/evaluate_layer1.py
```

### End-to-end API benchmark

Terminal A:
```bash
uvicorn main:app --app-dir . --host 127.0.0.1 --port 8000
```

Terminal B:
```bash
python tests/test_layer1.py
```

---

## 8) Notes for video datasets

Current endpoint is image-based. For video datasets (FaceForensics++), extract frames first, then place frames in:
- `test_data/real/`
- `test_data/fake/`

Then run calibration/evaluation/test scripts above.

---

## 9) Git push steps (shared repository)

> Run these from `mediaforensics-backend`.

```bash
cd /Volumes/Tanmay/MediaForensics/mediaforensics-backend

# 1) Check branch and changes
git status
git branch

# 2) (Optional but recommended) remove large/temporary artifacts from staging scope
#    Make sure you do NOT commit .venv, test_data, log files, or cache folders.

# 3) Stage code + docs
git add main.py layer1 schemas tests README.md

# 4) Commit
git commit -m "Integrate C2PA validation with c2patool and document Layer 1 integration"

# 5) Push current branch
git push origin <your-branch-name>
```

If this is your first push for a new branch:

```bash
git push -u origin <your-branch-name>
```

Then open a PR in your shared repository.

---

## 10) Minimal checklist before PR

- API starts (`/health` works)
- `/analyze/image` returns valid JSON shape
- `tests/evaluate_layer1.py` runs on current dataset
- `tests/test_layer1.py` reports real/fake summary
- README is up to date
