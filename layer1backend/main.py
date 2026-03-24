import os

from fastapi import FastAPI, File, HTTPException, UploadFile

from layer1.c2pa_validator import validate_c2pa
from layer1.exif_validator import validate_exif
from layer1.prnu_extractor import extract_prnu
from layer1.steg_detector import detect_steg
from schemas.output_schema import Layer1Output

app = FastAPI(title="MediaForensics Layer 1 API")


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
