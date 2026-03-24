from __future__ import annotations

import argparse
import os
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from layer1.c2pa_validator import validate_c2pa
from layer1.exif_validator import validate_exif
from layer1.prnu_extractor import extract_prnu
from layer1.steg_detector import detect_steg

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}


def iter_images(folder: Path) -> list[Path]:
    if not folder.exists():
        return []
    return sorted(
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in VALID_EXTENSIONS
    )


def read_weights() -> tuple[float, float, float, float]:
    w_exif = float(os.getenv("LAYER1_W_EXIF", "0.30"))
    w_steg = float(os.getenv("LAYER1_W_STEG", "0.25"))
    w_prnu = float(os.getenv("LAYER1_W_PRNU", "0.25"))
    w_c2pa = float(os.getenv("LAYER1_W_C2PA", "0.20"))
    total = w_exif + w_steg + w_prnu + w_c2pa
    if total <= 0:
        raise ValueError("Weights must sum to a positive number")
    return w_exif / total, w_steg / total, w_prnu / total, w_c2pa / total


def analyze_image(path: Path, weights: tuple[float, float, float, float]) -> tuple[float, float, float, float, float] | None:
    try:
        image_bytes = path.read_bytes()
        c2pa_score = float(validate_c2pa(image_bytes)["c2pa_score"])
        exif_score = float(validate_exif(image_bytes)["exif_score"])
        steg_score = float(detect_steg(image_bytes)["steg_score"])
        prnu_score = float(extract_prnu(image_bytes)["prnu_score"])
        layer1_score = (
            weights[0] * exif_score
            + weights[1] * steg_score
            + weights[2] * prnu_score
            + weights[3] * c2pa_score
        )
        return exif_score, steg_score, prnu_score, c2pa_score, layer1_score
    except Exception as error:
        print(f"[WARN] Skipping {path.name}: {error}")
        return None


def summarize(values: list[float]) -> tuple[float, float, float, float]:
    if not values:
        return 0.0, 0.0, 0.0, 0.0
    return (
        statistics.mean(values),
        statistics.pstdev(values),
        min(values),
        max(values),
    )


def best_threshold(real_scores: list[float], fake_scores: list[float]) -> tuple[float, float, float, float]:
    candidates = sorted(set(real_scores + fake_scores))
    if not candidates:
        return 0.5, 0.0, 0.0, 0.0

    best_t = candidates[0]
    best_bal_acc = -1.0
    best_tpr = 0.0
    best_tnr = 0.0

    for threshold in candidates:
        tp = sum(score >= threshold for score in real_scores)
        fn = len(real_scores) - tp
        tn = sum(score < threshold for score in fake_scores)
        fp = len(fake_scores) - tn

        tpr = tp / (tp + fn) if (tp + fn) else 0.0
        tnr = tn / (tn + fp) if (tn + fp) else 0.0
        bal_acc = 0.5 * (tpr + tnr)

        if bal_acc > best_bal_acc:
            best_bal_acc = bal_acc
            best_t = threshold
            best_tpr = tpr
            best_tnr = tnr

    return best_t, best_bal_acc, best_tpr, best_tnr


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate Layer 1 score separation")
    parser.add_argument("--real", default=str(ROOT / "test_data" / "real"))
    parser.add_argument("--fake", default=str(ROOT / "test_data" / "fake"))
    args = parser.parse_args()

    real_dir = Path(args.real)
    fake_dir = Path(args.fake)

    real_paths = iter_images(real_dir)
    fake_paths = iter_images(fake_dir)

    if not real_paths or not fake_paths:
        print("[ERROR] Missing dataset images.")
        print(f"Real dir: {real_dir}")
        print(f"Fake dir: {fake_dir}")
        return

    weights = read_weights()
    print(
        "Using weights (EXIF, STEG, PRNU, C2PA): "
        f"({weights[0]:.2f}, {weights[1]:.2f}, {weights[2]:.2f}, {weights[3]:.2f})"
    )
    print(f"Loaded real={len(real_paths)} fake={len(fake_paths)}")

    real_rows = [row for path in real_paths if (row := analyze_image(path, weights)) is not None]
    fake_rows = [row for path in fake_paths if (row := analyze_image(path, weights)) is not None]

    real_exif = [r[0] for r in real_rows]
    real_steg = [r[1] for r in real_rows]
    real_prnu = [r[2] for r in real_rows]
    real_c2pa = [r[3] for r in real_rows]
    real_l1 = [r[4] for r in real_rows]

    fake_exif = [r[0] for r in fake_rows]
    fake_steg = [r[1] for r in fake_rows]
    fake_prnu = [r[2] for r in fake_rows]
    fake_c2pa = [r[3] for r in fake_rows]
    fake_l1 = [r[4] for r in fake_rows]

    threshold, bal_acc, tpr, tnr = best_threshold(real_l1, fake_l1)

    print("\n=== Means (real vs fake) ===")
    print(f"EXIF: {statistics.mean(real_exif):.4f} vs {statistics.mean(fake_exif):.4f}")
    print(f"STEG: {statistics.mean(real_steg):.4f} vs {statistics.mean(fake_steg):.4f}")
    print(f"PRNU: {statistics.mean(real_prnu):.4f} vs {statistics.mean(fake_prnu):.4f}")
    print(f"C2PA: {statistics.mean(real_c2pa):.4f} vs {statistics.mean(fake_c2pa):.4f}")
    print(f"LAYER1: {statistics.mean(real_l1):.4f} vs {statistics.mean(fake_l1):.4f}")

    real_mean, real_std, real_min, real_max = summarize(real_l1)
    fake_mean, fake_std, fake_min, fake_max = summarize(fake_l1)

    print("\n=== Layer1 distribution ===")
    print(f"Real  -> mean={real_mean:.4f} std={real_std:.4f} min={real_min:.4f} max={real_max:.4f}")
    print(f"Fake  -> mean={fake_mean:.4f} std={fake_std:.4f} min={fake_min:.4f} max={fake_max:.4f}")

    print("\n=== Suggested cutoff ===")
    print(f"Recommended threshold: {threshold:.4f}")
    print(f"Balanced accuracy: {bal_acc:.4f}")
    print(f"TPR (real kept): {tpr:.4f}")
    print(f"TNR (fake rejected): {tnr:.4f}")


if __name__ == "__main__":
    main()
