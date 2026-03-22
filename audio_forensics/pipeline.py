import time
import os
import numpy as np
from typing import Dict, Any, Tuple

from .audio_utils import load_audio, is_speech_present, normalize_audio
from .enf_analyzer import run_enf_analysis
from .prosodic_analyzer import run_prosodic_analysis, _empty_prosodic_response
from .glottal_analyzer import run_glottal_analysis, _empty_glottal_response
from .room_acoustic_analyzer import run_room_analysis, _empty_room_response
from .schemas import get_empty_result, AudioForensicsResult

# --- Constants ---
WEIGHT_ENF = 0.25
WEIGHT_PROSODY = 0.35
WEIGHT_GLOTTAL = 0.20
WEIGHT_ROOM = 0.20
MIN_CONFIDENCE_THRESHOLD = 0.3
OVERALL_CONFIDENCE_MIN = 0.4
AUTH_THRESHOLD_HIGH = 0.75
AUTH_THRESHOLD_LOW = 0.50

def fuse_scores(layer_confidences: dict, layer_scores: dict) -> Tuple[float, float, int]:
    """
    Computes final authenticity score, overall confidence, and valid module count.
    
    Args:
        layer_confidences (dict): Confidences per module.
        layer_scores (dict): Scores per module.
        
    Returns:
        Tuple[float, float, int]: final_score, overall_confidence, valid_modules
    """
    weights = {"enf": WEIGHT_ENF, "prosody": WEIGHT_PROSODY, "glottal": WEIGHT_GLOTTAL, "room": WEIGHT_ROOM}
    weighted_score_sum = 0.0
    weight_sum = 0.0
    valid_modules = 0
    conf_sum = 0.0
    conf_weight_sum = 0.0
    
    score_mapping = {
        "enf": "enf_score",
        "prosody": "prosody_score",
        "glottal": "glottal_score",
        "room": "room_acoustic_score"
    }
    for key, conf in layer_confidences.items():
        score = layer_scores.get(score_mapping[key])
        if conf > MIN_CONFIDENCE_THRESHOLD and score is not None:
            w = weights[key] * conf
            weighted_score_sum += score * w
            weight_sum += w
            valid_modules += 1
            
        conf_sum += conf * weights[key]
        conf_weight_sum += weights[key]

    final_score = weighted_score_sum / weight_sum if weight_sum > 0 else 0.0
    overall_conf = conf_sum / conf_weight_sum if conf_weight_sum > 0 else 0.0
    
    return float(final_score), float(overall_conf), valid_modules

def _run_sub_modules(audio: np.ndarray, sr: int, is_speech: bool, result: AudioForensicsResult) -> list:
    errors = []
    
    # ENF
    try:
        enf = run_enf_analysis(audio, sr)
        result["enf_analysis"], result["layer_scores"]["enf_score"] = enf, enf.get("enf_consistency_score")
        if enf.get("flags"): result["all_flags"].extend(enf["flags"])
    except Exception as e:
        errors.append(f"ENF: {e}")
        result["enf_analysis"] = {"confidence": 0.0, "error": str(e)}

    # Room
    try:
        room = run_room_analysis(audio, sr)
        result["room_acoustic_analysis"], result["layer_scores"]["room_acoustic_score"] = room, room.get("room_consistency_score")
        if room.get("flags"): result["all_flags"].extend(room["flags"])
    except Exception as e:
        errors.append(f"Room: {e}")
        result["room_acoustic_analysis"] = _empty_room_response(str(e))

    # Prosody
    try:
        pros = run_prosodic_analysis(audio, sr) if is_speech else _empty_prosodic_response()
        result["prosodic_analysis"], result["layer_scores"]["prosody_score"] = pros, pros.get("prosody_naturalness_score")
        if pros.get("anomalies"): result["all_anomalies"].extend(pros["anomalies"])
    except Exception as e:
        errors.append(f"Prosody: {e}")
        result["prosodic_analysis"] = _empty_prosodic_response()
        result["prosodic_analysis"]["anomalies"].append(str(e))

    # Glottal
    try:
        glot = run_glottal_analysis(audio, sr) if is_speech else _empty_glottal_response("No speech")
        result["glottal_analysis"], result["layer_scores"]["glottal_score"] = glot, glot.get("glottal_naturalness_score")
        if glot.get("anomalies"): result["all_anomalies"].extend(glot["anomalies"])
    except Exception as e:
        errors.append(f"Glottal: {e}")
        result["glottal_analysis"] = _empty_glottal_response(str(e))
        
    return errors

def analyze_audio_pipeline(file_path: str) -> AudioForensicsResult:
    """Orchestrates all audio forensics analyses."""
    start_time = time.time()
    result = get_empty_result(file_path)
    
    if not os.path.exists(file_path): raise FileNotFoundError(f"File not found: {file_path}")
    try:
        audio, sr = load_audio(file_path, 22050)
        audio = normalize_audio(audio)
    except Exception as e:
        raise ValueError(f"Failed to load audio: {e}")
        
    duration = len(audio) / sr
    result.update({"file_duration_sec": float(duration), "sample_rate_hz": int(sr), "audio_format": os.path.splitext(file_path)[1].lower().strip(".")})
    
    if duration < 0.5:
        result.update({"final_verdict": "INCONCLUSIVE", "error": "audio_too_short", "processing_time_sec": time.time() - start_time})
        return result
        
    is_speech = bool(is_speech_present(audio, sr))
    result["is_speech"] = is_speech
    
    errors = _run_sub_modules(audio, sr, is_speech, result)
    if errors: result["error"] = "; ".join(errors)
        
    layer_conf = {
        "enf": result["enf_analysis"].get("confidence", 0.0),
        "prosody": result["prosodic_analysis"].get("confidence", 0.0),
        "glottal": result["glottal_analysis"].get("confidence", 0.0),
        "room": result["room_acoustic_analysis"].get("confidence", 0.0)
    }
    
    score, conf, valid_mods = fuse_scores(layer_conf, result["layer_scores"])
    result.update({"authenticity_score": score, "overall_confidence": conf})

    if valid_mods < 2 or conf < OVERALL_CONFIDENCE_MIN:
        result["final_verdict"] = "INCONCLUSIVE"
    elif score >= AUTH_THRESHOLD_HIGH: result["final_verdict"] = "AUTHENTIC"
    elif score >= AUTH_THRESHOLD_LOW: result["final_verdict"] = "SUSPICIOUS"
    else: result["final_verdict"] = "LIKELY_FAKE"

    result["processing_time_sec"] = float(time.time() - start_time)
    return result
