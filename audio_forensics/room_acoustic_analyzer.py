import numpy as np
import scipy.stats as stats
import scipy.signal as signal
import librosa
from typing import Dict, Any, List, Tuple
from .audio_utils import is_speech_present, get_speech_segments

# --- Constants ---
ROOM_WINDOW_SEC = 2.0
ROOM_MIN_DECAY_DB = -5.0
ROOM_MAX_DECAY_DB = -35.0
ROOM_DRR_MS = 2.5
ROOM_EARLY_MS = 50.0
RT60_REAL_ROOM_MIN_MS = 100.0
RT60_REAL_ROOM_MAX_MS = 1500.0
RT60_CV_THRESHOLD_SPLICE = 0.30
RT60_CV_THRESHOLD_REAL = 0.15

def estimate_rt60(segment: np.ndarray, sr: int) -> float:
    """Estimates RT60 using Schroeder backward integration on energy decay curve."""
    # Find signal envelope using Hilbert transform
    analytic_signal = signal.hilbert(segment)
    envelope = np.abs(analytic_signal)
    
    # Calculate energy
    energy = envelope ** 2
    
    # Backward integration (Schroeder)
    # E(t) = \int_t^\infty h^2(tau) d\tau
    # We estimate by summing from the end backwards
    schroeder = np.cumsum(energy[::-1])[::-1]
    
    # Convert to log scale (dB)
    with np.errstate(divide='ignore', invalid='ignore'):
        schroeder_db = 10 * np.log10(schroeder / np.max(schroeder))
        
    schroeder_db = np.nan_to_num(schroeder_db, neginf=-100)
    
    # Time vector
    t = np.arange(len(schroeder_db)) / sr
    
    # Find indices for linear regression (-5 dB to -35 dB)
    start_idx_arr = np.where(schroeder_db <= ROOM_MIN_DECAY_DB)[0]
    end_idx_arr = np.where(schroeder_db <= ROOM_MAX_DECAY_DB)[0]
    
    if len(start_idx_arr) == 0 or len(end_idx_arr) == 0:
        return 0.0
        
    start_idx = start_idx_arr[0]
    end_idx = end_idx_arr[0]
    
    if end_idx <= start_idx + int(sr * 0.01): # At least 10ms for regression
        return 0.0
        
    t_reg = t[start_idx:end_idx]
    s_reg = schroeder_db[start_idx:end_idx]
    
    # Fit line: s_reg = slope * t_reg + intercept
    slope, intercept, r_value, p_value, std_err = stats.linregress(t_reg, s_reg)
    
    if slope >= 0:
        return 0.0 # Decaying curve should have negative slope
        
    # Extrapolate to -60 dB
    # -60 = slope * rt60 + intercept  =>  rt60 = (-60 - intercept) / slope
    rt60_sec = (-60.0 - intercept) / slope
    
    return float(rt60_sec * 1000.0) # return in ms

def compute_drr(audio: np.ndarray, sr: int) -> float:
    """Estimates Direct-to-Reverberant Ratio (DRR) in dB."""
    # Approximate using onsets
    onset_frames = librosa.onset.onset_detect(y=audio, sr=sr, wait=int(sr * 0.1 / 512))
    onset_samples = librosa.frames_to_samples(onset_frames)
    
    if len(onset_samples) == 0:
        return 0.0
        
    drr_vals = []
    direct_samples = int(sr * ROOM_DRR_MS / 1000.0)
    
    for onset in onset_samples:
        start = onset
        direct_end = min(onset + direct_samples, len(audio))
        reverb_end = min(onset + int(sr * 0.2), len(audio)) # Look at next 200ms
        
        if direct_end <= start or reverb_end <= direct_end:
            continue
            
        direct_energy = np.sum(audio[start:direct_end]**2)
        reverb_energy = np.sum(audio[direct_end:reverb_end]**2)
        
        if reverb_energy > 0:
            drr = 10 * np.log10(direct_energy / reverb_energy)
            drr_vals.append(drr)
            
    if not drr_vals:
        return 0.0
        
    return float(np.mean(drr_vals))

def analyze_early_reflections(audio: np.ndarray, sr: int) -> bool:
    """Examines first 50ms for distinct early reflection peaks."""
    early_samples = int(sr * ROOM_EARLY_MS / 1000.0)
    
    # We'll use the autocorrelation of the squared envelope of onsets
    onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
    if len(onset_env) == 0:
        return False
        
    # Pick the strongest onset
    peak_idx = np.argmax(onset_env)
    peak_sample = librosa.frames_to_samples([peak_idx])[0]
    
    start = peak_sample
    end = min(start + early_samples, len(audio))
    
    if end - start < 10:
        return False
        
    early_segment = audio[start:end]
    env = np.abs(signal.hilbert(early_segment))
    autocorr = signal.correlate(env, env, mode='full')
    autocorr = autocorr[len(autocorr)//2:]
    
    # Find peaks in autocorr (excluding zero lag)
    peaks, _ = signal.find_peaks(autocorr, distance=int(sr * 0.002)) # at least 2ms apart
    
    if len(peaks) > 1: # Zero lag is a peak, we want at least one more
        return True # Discrete reflections detected
    return False

def _empty_room_response(note: str = "") -> Dict[str, Any]:
    return {
        "rt60_mean_ms": 0.0,
        "rt60_std_ms": 0.0,
        "rt60_cv": 0.0,
        "rt60_per_segment": [],
        "segment_timestamps_sec": [],
        "drr_db": 0.0,
        "room_consistency_score": 0.0,
        "acoustic_environment": "unknown",
        "splice_suspected": False,
        "early_reflections_detected": False,
        "flags": [note] if note else [],
        "confidence": 0.0
    }

def run_room_analysis(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Analyzes room acoustics, RT60 consistency, and detects splices/synthesis.
    
    Args:
        audio (np.ndarray): Mono audio array.
        sr (int): Original sample rate.
        
    Returns:
        Dict[str, Any]: Output matching room acoustics section of schema.
    """
    if len(audio) == 0:
        return _empty_room_response(note="Empty audio.")

    if not is_speech_present(audio, sr):
        return _empty_room_response(note="No speech detected.")

    # Convert to float32 safely
    audio = audio.astype(np.float32)
    segments = get_speech_segments(audio, sr)
    
    window_samples = int(sr * ROOM_WINDOW_SEC)
    
    rt60_list = []
    ts_list = []
    
    for start, end in segments:
        for w_start in range(start, end, window_samples):
            w_end = min(w_start + window_samples, end)
            if w_end - w_start < window_samples / 2: # Ignore short trailing segments
                continue
                
            segment_audio = audio[w_start:w_end]
            rt60 = estimate_rt60(segment_audio, sr)
            
            if rt60 > 0:
                rt60_list.append(rt60)
                ts_list.append(float(w_start / sr))
                
    if not rt60_list:
        return _empty_room_response(note="Could not estimate RT60 (too dry or short or noisy).")
        
    rt60_mean = float(np.mean(rt60_list))
    rt60_std = float(np.std(rt60_list))
    rt60_cv = float(rt60_std / rt60_mean) if rt60_mean > 0 else 0.0
    
    drr = compute_drr(audio, sr)
    er_detected = analyze_early_reflections(audio, sr)
    
    flags = []
    env_type = "unknown"
    score = 0.5
    splice_suspected = False
    
    # Env classification
    if rt60_mean < 50.0:
        env_type = "anechoic"
        flags.append("unnaturally_dry_acoustics")
        score = 0.2
    elif rt60_mean > 3000.0:
        env_type = "artificial_reverb"
        flags.append("excessive_reverberation")
        score = 0.2
    else:
        if rt60_cv > RT60_CV_THRESHOLD_SPLICE:
            env_type = "inconsistent"
            flags.append("inconsistent_room_acoustics")
            splice_suspected = True
            score = 0.1
        elif rt60_cv < RT60_CV_THRESHOLD_REAL:
            env_type = "real_room"
            score = 1.0
        else:
            env_type = "real_room"
            score = 0.8
            
    if not er_detected and env_type == "real_room" and rt60_mean > 200:
        # Reverb present but no discrete reflections -> likely artificial smooth reverb
        flags.append("missing_early_reflections")
        env_type = "artificial_reverb"
        score *= 0.5
        
    confidence = min(1.0, len(rt60_list) / 5.0) # >5 segments = full confidence

    return {
        "rt60_mean_ms": rt60_mean,
        "rt60_std_ms": rt60_std,
        "rt60_cv": rt60_cv,
        "rt60_per_segment": [float(r) for r in rt60_list],
        "segment_timestamps_sec": [float(t) for t in ts_list],
        "drr_db": drr,
        "room_consistency_score": float(score),
        "acoustic_environment": env_type,
        "splice_suspected": splice_suspected,
        "early_reflections_detected": er_detected,
        "flags": flags,
        "confidence": float(confidence)
    }
