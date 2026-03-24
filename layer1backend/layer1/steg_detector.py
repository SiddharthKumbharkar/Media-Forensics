from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image, UnidentifiedImageError
from scipy.fftpack import dct
from scipy.stats import chi2


def _dct2(block: np.ndarray) -> np.ndarray:
	return dct(dct(block.T, norm="ortho").T, norm="ortho")


def detect_steg(image_bytes: bytes) -> dict:
	try:
		image = Image.open(BytesIO(image_bytes)).convert("L")
	except UnidentifiedImageError as error:
		raise ValueError("Invalid image bytes") from error

	pixels = np.array(image, dtype=np.uint8)
	flat_pixels = pixels.ravel()

	lsb_bits = flat_pixels & 1
	ones = int(lsb_bits.sum())
	zeros = int(lsb_bits.size - ones)
	expected = lsb_bits.size / 2
	chi_sq = ((ones - expected) ** 2 / expected) + ((zeros - expected) ** 2 / expected)
	p_value = chi2.sf(chi_sq, df=1)
	lsb_anomaly = p_value < 0.01

	height, width = pixels.shape
	usable_h = height - (height % 8)
	usable_w = width - (width % 8)
	dct_anomaly = False

	if usable_h >= 8 and usable_w >= 8:
		cropped = pixels[:usable_h, :usable_w].astype(np.float32) - 128.0
		blocks = cropped.reshape(usable_h // 8, 8, usable_w // 8, 8).swapaxes(1, 2).reshape(-1, 8, 8)

		coeffs: list[np.ndarray] = []
		for block in blocks:
			transformed = _dct2(block)
			coeffs.append(np.abs(np.rint(transformed[1:, 1:])).ravel())

		all_coeffs = np.concatenate(coeffs)
		bins = np.arange(0, 21)
		hist, _ = np.histogram(np.clip(all_coeffs, 0, 20), bins=bins)

		descending_violations = 0
		valid_steps = 0
		for idx in range(2, len(hist) - 1):
			if hist[idx - 1] > 0:
				valid_steps += 1
				if hist[idx] > hist[idx - 1] * 1.15:
					descending_violations += 1

		zero_ratio = hist[0] / max(1, hist.sum())
		violation_ratio = descending_violations / max(1, valid_steps)
		dct_anomaly = violation_ratio > 0.35 or zero_ratio < 0.05

	anomaly_count = int(lsb_anomaly) + int(dct_anomaly)
	steg_score = max(0.0, min(1.0, 1.0 - 0.5 * anomaly_count))

	return {
		"lsb_anomaly": bool(lsb_anomaly),
		"dct_anomaly": bool(dct_anomaly),
		"steg_score": round(float(steg_score), 4),
	}
