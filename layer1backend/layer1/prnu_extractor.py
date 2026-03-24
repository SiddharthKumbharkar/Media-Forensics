from __future__ import annotations

from io import BytesIO

import numpy as np
from PIL import Image, UnidentifiedImageError
from scipy.ndimage import gaussian_filter


def _corr(a: np.ndarray, b: np.ndarray) -> float:
	a_flat = a.ravel()
	b_flat = b.ravel()
	a_std = float(np.std(a_flat))
	b_std = float(np.std(b_flat))
	if a_std == 0.0 or b_std == 0.0:
		return 0.0
	return float(np.corrcoef(a_flat, b_flat)[0, 1])


def extract_prnu(image_bytes: bytes) -> dict:
	try:
		image = Image.open(BytesIO(image_bytes)).convert("L")
	except UnidentifiedImageError as error:
		raise ValueError("Invalid image bytes") from error

	gray = np.asarray(image, dtype=np.float32) / 255.0
	denoised = gaussian_filter(gray, sigma=1.0)
	noise = gray - denoised

	noise_variance = float(np.var(noise))

	correlations: list[float] = []
	if noise.shape[0] > 4 and noise.shape[1] > 4:
		correlations.append(_corr(noise[2:, :], noise[:-2, :]))
		correlations.append(_corr(noise[:, 2:], noise[:, :-2]))
		correlations.append(_corr(noise[2:, 2:], noise[:-2, :-2]))
		correlations.append(_corr(noise[1:, 1:], noise[:-1, :-1]))

	spatial_correlation = float(np.mean(correlations)) if correlations else 0.0

	variance_score = float(np.exp(-abs(noise_variance - 0.0025) / 0.0025))
	corr_score = float(np.clip((spatial_correlation - 0.02) / 0.18, 0.0, 1.0))
	prnu_score = float(np.clip(0.5 * variance_score + 0.5 * corr_score, 0.0, 1.0))

	return {
		"noise_variance": round(noise_variance, 6),
		"spatial_correlation": round(spatial_correlation, 6),
		"prnu_score": round(prnu_score, 4),
	}
