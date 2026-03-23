from __future__ import annotations

import mimetypes
from pathlib import Path

import requests

API_URL = "http://localhost:8000/analyze/image"
ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "test_data" / "real"
FAKE_DIR = ROOT / "test_data" / "fake"
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}


def iter_images(folder: Path) -> list[Path]:
	if not folder.exists():
		return []
	return sorted(
		path
		for path in folder.rglob("*")
		if path.is_file() and path.suffix.lower() in VALID_EXTENSIONS
	)


def post_image(path: Path) -> float | None:
	mime_type, _ = mimetypes.guess_type(path.name)
	content_type = mime_type or "image/jpeg"

	with path.open("rb") as file_handle:
		response = requests.post(
			API_URL,
			files={"file": (path.name, file_handle, content_type)},
			timeout=30,
		)

	if response.status_code != 200:
		print(f"[ERROR] {path.name} -> {response.status_code}: {response.text}")
		return None

	payload = response.json()
	score = payload.get("layer1_score")
	if score is None:
		print(f"[ERROR] {path.name} -> Missing layer1_score in response")
		return None
	return float(score)


def average(scores: list[float]) -> float:
	return sum(scores) / len(scores) if scores else 0.0


def run_dataset(folder: Path, label: str) -> list[float]:
	paths = iter_images(folder)
	if not paths:
		print(f"[WARN] No images found in {folder}")
		return []

	scores: list[float] = []
	print(f"\nRunning {label} set: {len(paths)} images")
	for image_path in paths:
		score = post_image(image_path)
		if score is not None:
			scores.append(score)
			print(f"{image_path.name}: {score:.4f}")
	return scores


if __name__ == "__main__":
	real_scores = run_dataset(REAL_DIR, "REAL")
	fake_scores = run_dataset(FAKE_DIR, "FAKE")

	real_avg = average(real_scores)
	fake_avg = average(fake_scores)

	print("\n=== Layer 1 Summary ===")
	print(f"Real images average score: {real_avg:.4f} (n={len(real_scores)})")
	print(f"Fake images average score: {fake_avg:.4f} (n={len(fake_scores)})")

	if real_scores and fake_scores:
		if real_avg > fake_avg:
			print("PASS: Real images score higher than fake images")
		else:
			print("CHECK: Real images are not scoring higher; tune thresholds/weights")
