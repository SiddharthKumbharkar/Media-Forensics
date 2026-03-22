import numpy as np
import librosa
from typing import Dict, Any, List, Tuple
from .audio_utils import is_speech_present, get_speech_segments

# --- Constants ---
PROSODY_TARGET_SR = 22050
F0_HOP_LENGTH = 128
JITTER_NORMAL_MIN = 0.002
JITTER_NORMAL_MAX = 0.01
SHIMMER_NORMAL_MIN = 0.01
SHIMMER_NORMAL_MAX = 0.05
HNR_HEALTHY_MIN_DB = 15.0
HNR_HEALTHY_MAX_DB = 25.0
SYLLABLE_CV_MIN = 0.3
SYLLABLE_CV_MAX = 0.6

try:
    import crepe
    HAS_CREPE = True
except ImportError:
    HAS_CREPE = False

def extract_f0(audio: np.ndarray, sr: int) -> Tuple[np.ndarray, np.ndarray]:
    """Extracts F0 using crepe if available, else librosa.pyin."""
    if HAS_CREPE:
        try:
            _, f0, confidence, _ = crepe.predict(audio, sr, viterbi=True, step_size=10, verbose=0)
            f0[confidence < 0.8] = 0
            return f0, confidence
        except Exception:
            pass # Fallback to pyin
            
    f0, voiced_flag, _ = librosa.pyin(
        audio, 
        sr=sr, 
        fmin=librosa.note_to_hz('C2'), 
        fmax=librosa.note_to_hz('C7'),
        frame_length=2048,
        hop_length=F0_HOP_LENGTH
    )
    f0 = np.nan_to_num(f0)
    f0[~voiced_flag] = 0
    return f0, voiced_flag.astype(float)

def compute_jitter_shimmer(audio: np.ndarray, f0: np.ndarray, sr: int) -> Tuple[float, float, float]:
    """Computes local jitter, RAP jitter, and local shimmer."""
    voiced_indices = np.where(f0 > 0)[0]
    if len(voiced_indices) < 10:
        return 0.0, 0.0, 0.0
        
    periods = sr / f0[voiced_indices]
    
    # Local Jitter
    period_diffs = np.abs(np.diff(periods))
    mean_period = np.mean(periods)
    if mean_period == 0:
        local_jitter = 0.0
    else:
        local_jitter = np.mean(period_diffs) / mean_period
        
    # RAP (Relative Average Perturbation) over 3 periods
    rap_jitter = 0.0
    if len(periods) >= 3:
        rap_num = np.abs(periods[1:-1] - (periods[:-2] + periods[1:-1] + periods[2:]) / 3)
        rap_jitter = np.mean(rap_num) / mean_period
        
    # Shimmer (approximate via amplitude envelope mapped to voiced frames)
    # Get RMS energy matching F0 frames
    rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=F0_HOP_LENGTH)[0]
    # Ensure lengths match
    min_len = min(len(rms), len(f0))
    rms = rms[:min_len]
    f0_cut = f0[:min_len]
    voiced_rms = rms[f0_cut > 0]
    
    local_shimmer = 0.0
    if len(voiced_rms) > 1:
        mean_rms = np.mean(voiced_rms)
        rms_diffs = np.abs(np.diff(voiced_rms))
        if mean_rms > 0:
            local_shimmer = np.mean(rms_diffs) / mean_rms
            
    return float(local_jitter), float(rap_jitter), float(local_shimmer)

def compute_hnr(audio: np.ndarray, sr: int) -> float:
    """Estimates Harmonics-to-Noise Ratio (HNR) using autocorrelation."""
    # Split into frames
    frames = librosa.util.frame(audio, frame_length=2048, hop_length=512)
    hnr_vals = []
    
    for i in range(frames.shape[1]):
        frame = frames[:, i]
        # Hanning window
        frame = frame * np.hanning(len(frame))
        autocorr = librosa.autocorrelate(frame)
        
        # Find peak excluding the zero lag
        zero_crossing = np.where(np.diff(np.sign(autocorr)))[0]
        if len(zero_crossing) > 0:
            start_search = zero_crossing[0]
            if start_search < len(autocorr):
                r_max = np.max(autocorr[start_search:])
                r_zero = autocorr[0]
                if r_max > 0 and r_zero > r_max:
                    # Normalized autocorr peak
                    r_norm = r_max / r_zero
                    if r_norm < 1.0:
                        hnr = 10 * np.log10(r_norm / (1 - r_norm))
                        hnr_vals.append(hnr)
                        
    if len(hnr_vals) > 0:
        return float(np.mean(hnr_vals))
    return 0.0

def compute_rhythm_stats(audio: np.ndarray, sr: int) -> Tuple[float, float]:
    """Detects syllable nuclei and computes inter-syllable interval stats."""
    envelope = np.abs(librosa.onset.onset_strength(y=audio, sr=sr))
    peaks = librosa.util.peak_pick(envelope, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
    
    if len(peaks) < 2:
        return 0.0, 0.0
        
    peak_times = librosa.frames_to_time(peaks, sr=sr)
    intervals = np.diff(peak_times)
    
    syllable_rate = len(peaks) / (len(audio) / sr)
    cv = float(np.std(intervals) / np.mean(intervals)) if np.mean(intervals) > 0 else 0.0
    
    return float(syllable_rate), float(cv)

def compute_pause_stats(audio: np.ndarray, sr: int) -> Tuple[int, float, float]:
    """Computes statistics of micro-pauses (silence frames)."""
    intervals = librosa.effects.split(audio, top_db=30)
    if len(intervals) <= 1:
        return 0, 0.0, 0.0
        
    pauses = []
    for i in range(len(intervals) - 1):
        pause_start = intervals[i][1]
        pause_end = intervals[i+1][0]
        pause_duration = (pause_end - pause_start) / sr * 1000 # in ms
        if pause_duration > 10.0:  # Ignore tiny glitches < 10ms
            pauses.append(pause_duration)
            
    if not pauses:
        return 0, 0.0, 0.0
        
    return len(pauses), float(np.mean(pauses)), float(np.std(pauses))

def run_prosodic_analysis(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Analyzes prosody, pitch, jitter, shimmer, HNR.
    
    Args:
        audio (np.ndarray): Mono audio array.
        sr (int): Sample rate.
        
    Returns:
        Dict[str, Any]: Matching prosodic schema.
    """
    if len(audio) == 0:
        return _empty_prosodic_response()

    if sr != PROSODY_TARGET_SR:
        try:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=PROSODY_TARGET_SR)
        except Exception:
            return _empty_prosodic_response()
        sr = PROSODY_TARGET_SR

    if not is_speech_present(audio, sr):
        resp = _empty_prosodic_response()
        resp["anomalies"].append("No speech detected.")
        resp["confidence"] = 0.0
        return resp

    # 1. Pipeline extraction
    f0, _ = extract_f0(audio, sr)
    voiced_f0 = f0[f0 > 0]
    
    if len(voiced_f0) < 10:
        resp = _empty_prosodic_response()
        resp["anomalies"].append("Not enough voiced frames.")
        resp["confidence"] = 0.0
        return resp
        
    f0_mean = float(np.mean(voiced_f0))
    f0_std = float(np.std(voiced_f0))
    f0_range = float(np.max(voiced_f0) - np.min(voiced_f0))
    voiced_frac = float(len(voiced_f0) / len(f0))
    
    jitter_loc, jitter_rap, shimmer_loc = compute_jitter_shimmer(audio, f0, sr)
    
    # 2. HNR
    hnr_raw = compute_hnr(audio, sr)
    
    # 3. Rhythm & Pauses
    syl_rate, syl_cv = compute_rhythm_stats(audio, sr)
    pause_count, pause_mean, pause_std = compute_pause_stats(audio, sr)
    
    # 4. Scoring & Anomalies
    anomalies = []
    score_components = []
    
    # Jitter scoring
    if jitter_loc < JITTER_NORMAL_MIN:
        anomalies.append(f"Jitter too low: {jitter_loc*100:.3f}%")
        score_components.append(0.0)
    elif JITTER_NORMAL_MIN <= jitter_loc <= JITTER_NORMAL_MAX:
        score_components.append(1.0)
    else:
        anomalies.append(f"Jitter high: {jitter_loc*100:.3f}%")
        score_components.append(max(0.0, 1.0 - (jitter_loc - JITTER_NORMAL_MAX)*50))
        
    # Shimmer scoring
    if shimmer_loc < SHIMMER_NORMAL_MIN:
        anomalies.append(f"Shimmer too low: {shimmer_loc*100:.2f}%")
        score_components.append(0.0)
    elif SHIMMER_NORMAL_MIN <= shimmer_loc <= SHIMMER_NORMAL_MAX:
        score_components.append(1.0)
    else:
        anomalies.append(f"Shimmer high: {shimmer_loc*100:.2f}%")
        score_components.append(max(0.0, 1.0 - (shimmer_loc - SHIMMER_NORMAL_MAX)*20))

    # HNR scoring
    if hnr_raw > HNR_HEALTHY_MAX_DB + 5.0:
        anomalies.append(f"HNR unusually high: {hnr_raw:.1f}dB")
        score_components.append(0.0)
    elif HNR_HEALTHY_MIN_DB <= hnr_raw <= HNR_HEALTHY_MAX_DB + 5.0:
        score_components.append(1.0)
    else:
        score_components.append(0.5)
        
    # Rhythm CV scoring
    if syl_cv < SYLLABLE_CV_MIN:
        anomalies.append(f"Syllable rhythm too regular (CV: {syl_cv:.2f})")
        score_components.append(0.0)
    elif SYLLABLE_CV_MIN <= syl_cv <= SYLLABLE_CV_MAX:
        score_components.append(1.0)
    else:
        score_components.append(0.5)

    final_score = float(np.mean(score_components))
    confidence = min(1.0, len(voiced_f0) / 100.0)  # >100 voiced frames = 1.0 confidence

    return {
        "f0_mean_hz": f0_mean,
        "f0_std_hz": f0_std,
        "f0_range_hz": f0_range,
        "voiced_fraction": voiced_frac,
        "jitter_local_percent": jitter_loc * 100.0,
        "jitter_rap_percent": jitter_rap * 100.0,
        "shimmer_local_percent": shimmer_loc * 100.0,
        "hnr_db": hnr_raw,
        "syllable_rate_per_sec": syl_rate,
        "syllable_interval_cv": syl_cv,
        "pause_count": pause_count,
        "pause_mean_ms": pause_mean,
        "pause_std_ms": pause_std,
        "prosody_naturalness_score": final_score,
        "anomalies": anomalies,
        "confidence": confidence
    }

def _empty_prosodic_response() -> Dict[str, Any]:
    return {
        "f0_mean_hz": 0.0,
        "f0_std_hz": 0.0,
        "f0_range_hz": 0.0,
        "voiced_fraction": 0.0,
        "jitter_local_percent": 0.0,
        "jitter_rap_percent": 0.0,
        "shimmer_local_percent": 0.0,
        "hnr_db": 0.0,
        "syllable_rate_per_sec": 0.0,
        "syllable_interval_cv": 0.0,
        "pause_count": 0,
        "pause_mean_ms": 0.0,
        "pause_std_ms": 0.0,
        "prosody_naturalness_score": 0.0,
        "anomalies": [],
        "confidence": 0.0
    }
