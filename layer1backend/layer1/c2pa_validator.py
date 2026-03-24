from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def _has_jpeg_app11_jumbf(data: bytes) -> bool:
	if len(data) < 4 or data[:2] != b"\xFF\xD8":
		return False

	index = 2
	data_len = len(data)
	while index + 4 <= data_len:
		if data[index] != 0xFF:
			index += 1
			continue

		marker = data[index + 1]
		index += 2

		if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
			continue

		if index + 2 > data_len:
			break

		segment_len = int.from_bytes(data[index : index + 2], "big")
		if segment_len < 2 or index + segment_len > data_len:
			break

		segment = data[index + 2 : index + segment_len]
		if marker == 0xEB and (b"jumb" in segment.lower() or b"c2pa" in segment.lower()):
			return True

		index += segment_len

	return False


def _guess_suffix(image_bytes: bytes) -> str:
	if image_bytes.startswith(b"\xFF\xD8\xFF"):
		return ".jpg"
	if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
		return ".png"
	if image_bytes[:4] in {b"RIFF", b"WEBP"}:
		return ".webp"
	if image_bytes[:4] in {b"II*\x00", b"MM\x00*"}:
		return ".tif"
	return ".bin"


def _collect_text_tokens(obj: object) -> list[str]:
	tokens: list[str] = []
	if isinstance(obj, dict):
		for value in obj.values():
			tokens.extend(_collect_text_tokens(value))
	elif isinstance(obj, list):
		for value in obj:
			tokens.extend(_collect_text_tokens(value))
	elif isinstance(obj, str):
		tokens.append(obj.lower())
	return tokens


def _verify_with_c2patool(image_bytes: bytes) -> dict | None:
	tool_path = os.getenv("C2PA_TOOL_PATH", "c2patool")
	resolved_tool = shutil.which(tool_path)
	if not resolved_tool:
		return None

	suffix = _guess_suffix(image_bytes)
	with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
		tmp_file.write(image_bytes)
		temp_path = Path(tmp_file.name)

	try:
		result = subprocess.run(
			[resolved_tool, str(temp_path), "--detailed"],
			capture_output=True,
			text=True,
			timeout=15,
		)
		stdout = result.stdout.strip()
		stderr = result.stderr.strip()
		combined = f"{stdout}\n{stderr}".strip().lower()

		if result.returncode != 0:
			if "no claim found" in combined:
				return {
					"c2pa_present": False,
					"c2pa_verified": False,
					"c2pa_score": 0.2,
					"note": "No C2PA claim found (verified by c2patool)",
				}

			if any(token in combined for token in ["claim", "manifest", "assertion", "signature"]):
				return {
					"c2pa_present": True,
					"c2pa_verified": False,
					"c2pa_score": 0.5,
					"note": "C2PA claim detected but failed validation in c2patool",
				}

			return {
				"c2pa_present": False,
				"c2pa_verified": False,
				"c2pa_score": 0.2,
				"note": "c2patool could not validate asset",
			}

		parsed: object | None = None
		try:
			if stdout:
				parsed = json.loads(stdout)
		except json.JSONDecodeError:
			parsed = None

		if parsed is not None:
			tokens = _collect_text_tokens(parsed)
		else:
			tokens = [combined]

		negative_markers = [
			"fail",
			"invalid",
			"mismatch",
			"untrusted",
			"revoked",
			"error",
		]
		has_negative = any(
			marker in token
			for token in tokens
			for marker in negative_markers
		)

		c2pa_present = True
		c2pa_verified = not has_negative

		if c2pa_verified:
			c2pa_score = 1.0
			note = "C2PA claim present and passed c2patool validation"
		else:
			c2pa_score = 0.65
			note = "C2PA claim present but validation warnings/errors detected"

		return {
			"c2pa_present": c2pa_present,
			"c2pa_verified": c2pa_verified,
			"c2pa_score": c2pa_score,
			"note": note,
		}
	except subprocess.TimeoutExpired:
		return {
			"c2pa_present": False,
			"c2pa_verified": False,
			"c2pa_score": 0.2,
			"note": "c2patool verification timed out",
		}
	finally:
		temp_path.unlink(missing_ok=True)


def validate_c2pa(image_bytes: bytes) -> dict:
	tool_result = _verify_with_c2patool(image_bytes)
	if tool_result is not None:
		return tool_result

	payload = image_bytes.lower()

	has_c2pa_token = b"c2pa" in payload
	has_jumbf_token = b"jumb" in payload or b"jumbf" in payload
	has_claim_token = b"manifest" in payload or b"assertion" in payload
	has_app11_jumbf = _has_jpeg_app11_jumbf(image_bytes)

	c2pa_present = bool((has_c2pa_token and has_jumbf_token) or has_app11_jumbf)

	confidence_hits = sum(
		[
			has_c2pa_token,
			has_jumbf_token,
			has_claim_token,
			has_app11_jumbf,
		]
	)
	c2pa_verified = c2pa_present and confidence_hits >= 3

	if c2pa_verified:
		c2pa_score = 1.0
		note = "C2PA/JUMBF markers found with strong confidence (heuristic fallback)"
	elif c2pa_present:
		c2pa_score = 0.65
		note = "Partial C2PA markers found (heuristic fallback)"
	else:
		c2pa_score = 0.2
		note = "No C2PA markers found (heuristic fallback)"

	return {
		"c2pa_present": c2pa_present,
		"c2pa_verified": c2pa_verified,
		"c2pa_score": c2pa_score,
		"note": note,
	}
