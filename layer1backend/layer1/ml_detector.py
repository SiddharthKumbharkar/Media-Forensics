from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parent
MODEL_CANDIDATE_PATHS = [
	PROJECT_ROOT / "Real-vs-AI-Image-Detector" / "EfficientNet_Models" / "EfficientNet_fine_tune_art_model.h5",
	REPO_ROOT / "Real-vs-AI-Image-Detector" / "EfficientNet_Models" / "EfficientNet_fine_tune_art_model.h5",
]


def _is_lfs_pointer(path: Path) -> bool:
	try:
		if path.stat().st_size > 1024:
			return False
		with path.open("r", encoding="utf-8", errors="ignore") as handle:
			header = handle.read(120)
		return "git-lfs.github.com/spec/v1" in header
	except Exception:
		return False


def _resolve_model_path() -> Path:
	pointer_paths: list[Path] = []
	for path in MODEL_CANDIDATE_PATHS:
		if not path.exists():
			continue
		if _is_lfs_pointer(path):
			pointer_paths.append(path)
			continue
		return path

	if pointer_paths:
		raise FileNotFoundError(
			"EfficientNet model file is a Git LFS pointer. Download model weights with: git lfs pull"
		)

	raise FileNotFoundError(
		"EfficientNet model weights not found. Expected one of: "
		+ ", ".join(str(p) for p in MODEL_CANDIDATE_PATHS)
	)


@lru_cache(maxsize=1)
def _load_efficientnet_model() -> Any:
	try:
		from tensorflow.keras.models import load_model  # type: ignore
	except Exception as error:
		raise RuntimeError(
			"TensorFlow is required for Real-vs-AI image detection. Install tensorflow==2.18.0."
		) from error

	model_path = _resolve_model_path()
	return load_model(model_path)


def _get_input_size(model: Any) -> tuple[int, int]:
	input_shape = getattr(model, "input_shape", None)
	if isinstance(input_shape, list) and input_shape:
		input_shape = input_shape[0]

	if not input_shape or len(input_shape) < 3:
		return (256, 256)

	height = int(input_shape[1]) if input_shape[1] is not None else 256
	width = int(input_shape[2]) if input_shape[2] is not None else 256
	return (height, width)


def _preprocess_image(image_path: str, target_size: tuple[int, int]) -> np.ndarray:
	from tensorflow.keras.preprocessing.image import img_to_array, load_img  # type: ignore

	image = load_img(image_path, target_size=target_size)
	image_arr = img_to_array(image) / 255.0
	return np.expand_dims(image_arr, axis=0)


def predict_ai_image(image_path: str) -> dict:
	"""
	Returns:
	{
		"label": "AI" | "Real",
		"confidence": float,
		"model": "EfficientNet"
	}
	"""
	model = _load_efficientnet_model()
	target_size = _get_input_size(model)
	batch = _preprocess_image(image_path, target_size)

	prediction = model.predict(batch, verbose=0)
	if prediction is None or np.size(prediction) == 0:
		raise RuntimeError("EfficientNet prediction returned an empty result")

	# In the source app logic: score < 0.5 => AI Generated, else REAL.
	probability_real = float(np.ravel(prediction)[0])
	probability_real = max(0.0, min(1.0, probability_real))

	if probability_real >= 0.5:
		label = "Real"
		confidence = probability_real
	else:
		label = "AI"
		confidence = 1.0 - probability_real

	return {
		"label": label,
		"confidence": round(float(confidence), 4),
		"model": "EfficientNet",
	}
