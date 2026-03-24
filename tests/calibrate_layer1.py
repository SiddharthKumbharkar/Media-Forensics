from __future__ import annotations

import itertools
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from layer1.c2pa_validator import validate_c2pa
from layer1.exif_validator import validate_exif
from layer1.prnu_extractor import extract_prnu
from layer1.steg_detector import detect_steg

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


def score_image(image_path: Path) -> tuple[float, float, float, float] | None:
    try:
        image_bytes = image_path.read_bytes()
        c2pa_score = float(validate_c2pa(image_bytes)["c2pa_score"])
        exif_score = float(validate_exif(image_bytes)["exif_score"])
        steg_score = float(detect_steg(image_bytes)["steg_score"])
        prnu_score = float(extract_prnu(image_bytes)["prnu_score"])
        return exif_score, steg_score, prnu_score, c2pa_score
    except Exception as error:
        print(f"[WARN] Skipping {image_path.name}: {error}")
        return None


def weighted(sample: tuple[float, float, float, float], weights: tuple[float, float, float, float]) -> float:
    return (
        sample[0] * weights[0]
        + sample[1] * weights[1]
        + sample[2] * weights[2]
        + sample[3] * weights[3]
    )


def pairwise_auc(real_scores: list[float], fake_scores: list[float]) -> float:
    if not real_scores or not fake_scores:
        return 0.0

    wins = 0.0
    total = len(real_scores) * len(fake_scores)
    for real_value in real_scores:
        for fake_value in fake_scores:
            if real_value > fake_value:
                wins += 1.0
            elif real_value == fake_value:
                wins += 0.5
    return wins / total


def grid_weights(step: float = 0.10) -> list[tuple[float, float, float, float]]:
    n = int(round(1.0 / step))
    values = [i * step for i in range(n + 1)]
    candidates: list[tuple[float, float, float, float]] = []
    for w_exif, w_steg, w_prnu in itertools.product(values, values, values):
        w_c2pa = 1.0 - w_exif - w_steg - w_prnu
        if w_c2pa < 0:
            continue
        w_c2pa = round(w_c2pa, 10)
        candidates.append(
            (round(w_exif, 2), round(w_steg, 2), round(w_prnu, 2), round(w_c2pa, 2))
        )
    return candidates


def main() -> None:
    real_images = iter_images(REAL_DIR)
    fake_images = iter_images(FAKE_DIR)

    if not real_images or not fake_images:
        print("[ERROR] Dataset missing. Expected images under:")
        print(f"  - {REAL_DIR}")
        print(f"  - {FAKE_DIR}")
        return

    print(f"Loaded {len(real_images)} real and {len(fake_images)} fake images")

    real_features = [feature for image in real_images if (feature := score_image(image)) is not None]
    fake_features = [feature for image in fake_images if (feature := score_image(image)) is not None]

    if not real_features or not fake_features:
        print("[ERROR] Could not score enough images to calibrate")
        return

    candidates = grid_weights(step=0.05)
    print(f"Evaluating {len(candidates)} weight combinations...")

    ranked: list[dict] = []
    for weights in candidates:
        real_scores = [weighted(sample, weights) for sample in real_features]
        fake_scores = [weighted(sample, weights) for sample in fake_features]

        real_avg = sum(real_scores) / len(real_scores)
        fake_avg = sum(fake_scores) / len(fake_scores)
        separation = real_avg - fake_avg
        auc_like = pairwise_auc(real_scores, fake_scores)

        ranked.append(
            {
                "weights": weights,
                "real_avg": real_avg,
                "fake_avg": fake_avg,
                "separation": separation,
                "auc_like": auc_like,
            }
        )

    ranked.sort(key=lambda row: (row["separation"], row["auc_like"]), reverse=True)

    print("\nTop 5 candidate weights (EXIF, STEG, PRNU, C2PA):")
    for idx, row in enumerate(ranked[:5], start=1):
        w_exif, w_steg, w_prnu, w_c2pa = row["weights"]
        print(
            f"{idx}. weights=({w_exif:.2f}, {w_steg:.2f}, {w_prnu:.2f}, {w_c2pa:.2f}) | "
            f"real_avg={row['real_avg']:.4f} fake_avg={row['fake_avg']:.4f} "
            f"sep={row['separation']:.4f} auc~={row['auc_like']:.4f}"
        )

    best = ranked[0]
    w_exif, w_steg, w_prnu, w_c2pa = best["weights"]
    print("\nRecommended environment settings:")
    print(f"LAYER1_W_EXIF={w_exif:.2f}")
    print(f"LAYER1_W_STEG={w_steg:.2f}")
    print(f"LAYER1_W_PRNU={w_prnu:.2f}")
    print(f"LAYER1_W_C2PA={w_c2pa:.2f}")


if __name__ == "__main__":
    main()