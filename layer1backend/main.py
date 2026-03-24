import os
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile

from layer1.c2pa_validator import validate_c2pa
from layer1.exif_validator import validate_exif
from layer1.prnu_extractor import extract_prnu
from layer1.steg_detector import detect_steg
from schemas.output_schema import Layer1Output

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
	sys.path.insert(0, str(PROJECT_ROOT))

from audio_forensics import analyze_audio

app = FastAPI(title="MediaForensics Layer 1 API")

AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".mp4", ".mov", ".avi", ".mkv", ".webm"}


def _get_weights() -> tuple[float, float, float, float]:
	w_exif = float(os.getenv("LAYER1_W_EXIF", "0.30"))
	w_steg = float(os.getenv("LAYER1_W_STEG", "0.25"))
	w_prnu = float(os.getenv("LAYER1_W_PRNU", "0.25"))
	w_c2pa = float(os.getenv("LAYER1_W_C2PA", "0.20"))

	total = w_exif + w_steg + w_prnu + w_c2pa
	if total <= 0:
		raise ValueError("Layer 1 weights must sum to a positive number")

	return (
		w_exif / total,
		w_steg / total,
		w_prnu / total,
		w_c2pa / total,
	)


@app.get("/health")
async def health_check() -> dict:
	return {"status": "ok"}


@app.post("/analyze/image", response_model=Layer1Output)
async def analyze_image(file: UploadFile = File(...)) -> Layer1Output:
	if not file.content_type or not file.content_type.startswith("image/"):
		raise HTTPException(status_code=400, detail="Uploaded file must be an image")

	image_bytes = await file.read()
	if not image_bytes:
		raise HTTPException(status_code=400, detail="Empty file upload")

	try:
		c2pa_result = validate_c2pa(image_bytes)
		metadata_result = validate_exif(image_bytes)
		steg_result = detect_steg(image_bytes)
		prnu_result = extract_prnu(image_bytes)
	except ValueError as error:
		raise HTTPException(status_code=400, detail=str(error)) from error
	except Exception as error:
		raise HTTPException(status_code=500, detail=f"Analysis failed: {error}") from error

	if not c2pa_result["c2pa_present"]:
		metadata_result["physics_violations"].append("No C2PA provenance marker found")
		metadata_result["exif_consistent"] = False

	if c2pa_result["c2pa_verified"]:
		metadata_result["physics_violations"].append("C2PA provenance marker present and high-confidence")

	try:
		w_exif, w_steg, w_prnu, w_c2pa = _get_weights()
	except ValueError as error:
		raise HTTPException(status_code=500, detail=str(error)) from error

	layer1_score = (
		w_exif * metadata_result["exif_score"]
		+ w_steg * steg_result["steg_score"]
		+ w_prnu * prnu_result["prnu_score"]
		+ w_c2pa * c2pa_result["c2pa_score"]
	)

	return Layer1Output(
		metadata=metadata_result,
		steganography=steg_result,
		prnu=prnu_result,
		layer1_score=round(float(layer1_score), 4),
	)


@app.post("/analyze/audio")
async def analyze_audio_file(file: UploadFile = File(...)) -> dict:
	file_name = file.filename or "uploaded_audio"
	extension = Path(file_name).suffix.lower()

	is_audio_content_type = bool(file.content_type and file.content_type.startswith("audio/"))
	if not is_audio_content_type and extension not in AUDIO_EXTENSIONS:
		raise HTTPException(status_code=400, detail="Uploaded file must be an audio file")

	audio_bytes = await file.read()
	if not audio_bytes:
		raise HTTPException(status_code=400, detail="Empty file upload")

	if extension == "":
		extension = ".wav"

	temp_file_path = ""
	try:
		with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
			temp_file.write(audio_bytes)
			temp_file_path = temp_file.name

		result = analyze_audio(temp_file_path)
		return result
	except ValueError as error:
		raise HTTPException(status_code=400, detail=str(error)) from error
	except FileNotFoundError as error:
		raise HTTPException(status_code=400, detail=str(error)) from error
	except Exception as error:
		raise HTTPException(status_code=500, detail=f"Audio analysis failed: {error}") from error
	finally:
		if temp_file_path and os.path.exists(temp_file_path):
			os.remove(temp_file_path)
