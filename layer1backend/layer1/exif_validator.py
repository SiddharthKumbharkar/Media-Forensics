from __future__ import annotations

import math
from fractions import Fraction
from io import BytesIO
from typing import Any

from PIL import Image, UnidentifiedImageError


def _to_float(value: Any) -> float | None:
	if value is None:
		return None
	if isinstance(value, (int, float)):
		return float(value)
	if isinstance(value, tuple) and len(value) == 2 and value[1] != 0:
		return float(value[0]) / float(value[1])
	try:
		return float(Fraction(value))
	except (TypeError, ValueError, ZeroDivisionError):
		return None


def validate_exif(image_bytes: bytes) -> dict:
	try:
		image = Image.open(BytesIO(image_bytes))
	except UnidentifiedImageError as error:
		raise ValueError("Invalid image bytes") from error

	exif = image.getexif()
	if not exif:
		return {
			"exif_consistent": False,
			"physics_violations": ["No EXIF metadata found"],
			"exif_score": 0.0,
		}

	iso = _to_float(exif.get(34855) or exif.get(34867))
	exposure_time = _to_float(exif.get(33434))
	f_number = _to_float(exif.get(33437))
	focal_length = _to_float(exif.get(37386))

	physics_violations: list[str] = []

	if iso is not None and iso <= 0:
		physics_violations.append("ISO must be positive")
	if exposure_time is not None and exposure_time <= 0:
		physics_violations.append("Shutter speed must be positive")
	if f_number is not None and f_number <= 0:
		physics_violations.append("Aperture f-number must be positive")
	if focal_length is not None and focal_length <= 0:
		physics_violations.append("Focal length must be positive")

	if iso is not None and exposure_time is not None and f_number is not None:
		if iso >= 3200 and exposure_time > (1 / 30):
			physics_violations.append("Very high ISO with slow shutter is physically unlikely")
		if iso <= 100 and exposure_time < (1 / 8000):
			physics_violations.append("Very low ISO with ultra-fast shutter is physically unlikely")

		ev100 = math.log2((f_number**2) / exposure_time) if exposure_time > 0 else None
		if ev100 is not None and (ev100 < -5 or ev100 > 24):
			physics_violations.append("Exposure value is outside plausible camera range")

	if focal_length is not None and f_number is not None and f_number > 0:
		entrance_pupil_mm = focal_length / f_number
		if entrance_pupil_mm > 120:
			physics_violations.append("Focal length/aperture implies implausibly large entrance pupil")
		if f_number < 0.7 or f_number > 64:
			physics_violations.append("Aperture f-number is outside physical lens range")

	missing_fields = sum(
		value is None for value in [iso, exposure_time, f_number, focal_length]
	)

	penalty = 0.2 * len(physics_violations) + 0.1 * missing_fields
	exif_score = max(0.0, min(1.0, 1.0 - penalty))

	return {
		"exif_consistent": len(physics_violations) == 0,
		"physics_violations": physics_violations,
		"exif_score": round(exif_score, 4),
	}
