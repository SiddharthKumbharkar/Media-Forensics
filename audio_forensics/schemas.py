from typing import Any, Dict, List, Optional, TypedDict

class LayerScores(TypedDict):
    """Scores for each individual analysis layer."""
    enf_score: Optional[float]
    prosody_score: Optional[float]
    glottal_score: Optional[float]
    room_acoustic_score: Optional[float]

class AudioForensicsResult(TypedDict):
    """Main output dict from analyze_audio()."""
    module: str
    version: str
    file_path: str
    file_duration_sec: float
    sample_rate_hz: int
    is_speech: bool
    audio_format: str
    
    final_verdict: str
    authenticity_score: float
    overall_confidence: float
    
    layer_scores: LayerScores
    
    enf_analysis: Dict[str, Any]
    prosodic_analysis: Dict[str, Any]
    glottal_analysis: Dict[str, Any]
    room_acoustic_analysis: Dict[str, Any]
    
    all_flags: List[str]
    all_anomalies: List[str]
    
    processing_time_sec: float
    error: Optional[str]

def get_empty_result(file_path: str) -> AudioForensicsResult:
    """Returns an empty result with initial default values."""
    return {
        "module": "audio_forensics",
        "version": "1.0.0",
        "file_path": file_path,
        "file_duration_sec": 0.0,
        "sample_rate_hz": 0,
        "is_speech": False,
        "audio_format": "",
        "final_verdict": "INCONCLUSIVE",
        "authenticity_score": 0.0,
        "overall_confidence": 0.0,
        "layer_scores": {
            "enf_score": None,
            "prosody_score": None,
            "glottal_score": None,
            "room_acoustic_score": None
        },
        "enf_analysis": {},
        "prosodic_analysis": {},
        "glottal_analysis": {},
        "room_acoustic_analysis": {},
        "all_flags": [],
        "all_anomalies": [],
        "processing_time_sec": 0.0,
        "error": None
    }
