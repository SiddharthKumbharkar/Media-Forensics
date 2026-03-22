import numpy as np
import scipy.signal as signal
from typing import Dict, Any, List, Tuple
from .audio_utils import load_audio, compute_snr

# --- Constants ---
ENF_TARGET_SR = 8000
ENF_STFT_NPERSEG = 8192
ENF_STFT_NOVERLAP = 7168
ENF_HARMONICS_50 = [50.0, 100.0, 150.0, 200.0, 250.0]
ENF_HARMONICS_60 = [60.0, 120.0, 180.0, 240.0, 300.0]
ENF_BAND_WIDTH = 1.0  # +/- 0.5 Hz
ENF_SNR_THRESHOLD_DB = 10.0
ENF_FLAT_STD_THRESHOLD = 0.005
ENF_SPLICE_JUMP_THRESHOLD = 0.2

def extract_enf(audio: np.ndarray, harmonics: List[float], sr: int) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Extracts the ENF trace by bandpass filtering and STFT over predefined harmonics.
    
    Args:
        audio (np.ndarray): The resampled audio at ENF_TARGET_SR.
        harmonics (List[float]): Harmonics of 50 or 60 Hz.
        sr (int): Sample rate.
        
    Returns:
        Tuple[np.ndarray, np.ndarray, float]: (enf_trace, time_stamps, combined_snr)
    """
    # 1. Bandpass filter for harmonics
    filtered_signals = []
    for f_center in harmonics:
        lowcut = f_center - (ENF_BAND_WIDTH / 2)
        highcut = f_center + (ENF_BAND_WIDTH / 2)
        b, a = signal.butter(4, [lowcut, highcut], btype='bandpass', fs=sr)
        filt_audio = signal.filtfilt(b, a, audio)
        filtered_signals.append(filt_audio)
    
    combined_signal = np.sum(filtered_signals, axis=0)
    snr = compute_snr(combined_signal)
    
    f, t, Zxx = signal.stft(
        combined_signal,
        fs=sr,
        window='hann',
        nperseg=ENF_STFT_NPERSEG,
        noverlap=ENF_STFT_NOVERLAP
    )
    
    magnitude = np.abs(Zxx)
    enf_trace = []
    base_freq = harmonics[0]
    
    for time_idx in range(magnitude.shape[1]):
        frame_mag = magnitude[:, time_idx]
        valid_idxs = []
        for h in harmonics:
            idx_low = np.argmin(np.abs(f - (h - ENF_BAND_WIDTH/2)))
            idx_high = np.argmin(np.abs(f - (h + ENF_BAND_WIDTH/2)))
            valid_idxs.extend(list(range(idx_low, idx_high + 1)))
            
        valid_idxs = list(set(valid_idxs))
        valid_idxs.sort()
        
        # Prevent max over empty sequence
        if not valid_idxs:
            enf_trace.append(base_freq)
            continue
            
        peak_idx = valid_idxs[np.argmax(frame_mag[valid_idxs])]
        peak_freq = f[peak_idx]
        
        # Map back to fundamental (50 or 60) for consistency
        # Find which harmonic peak corresponds to
        harmonic_idx = int(round(peak_freq / base_freq))
        adjusted_freq = peak_freq / max(1, harmonic_idx)
        enf_trace.append(adjusted_freq)
        
    return np.array(enf_trace), t, snr

def _detect_splice(enf_trace: np.ndarray, time_stamps: np.ndarray) -> Tuple[bool, List[float]]:
    """Detects sudden jumps in ENF trace indicating a splice."""
    if len(enf_trace) < 2:
        return False, []
    
    diffs = np.abs(np.diff(enf_trace))
    splice_idxs = np.where(diffs > ENF_SPLICE_JUMP_THRESHOLD)[0]
    
    splice_times = []
    for idx in splice_idxs:
        splice_times.append(float(time_stamps[idx + 1]))
    
    return bool(len(splice_times) > 0), list(splice_times)

def run_enf_analysis(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Analyzes ENF (Electric Network Frequency) signature in audio.
    
    Args:
        audio (np.ndarray): Mono audio array.
        sr (int): Original sample rate.
        
    Returns:
        Dict[str, Any]: Output matching ENF section of schema.
    """
    if str(type(audio)) == "<class 'str'>":
        audio, sr = load_audio(audio, target_sr=ENF_TARGET_SR)
    else:
        # Avoid resampy overhead if possible, use scipy for fast internal resampling
        from librosa.core.audio import resample
        if sr != ENF_TARGET_SR:
            audio = resample(audio, orig_sr=sr, target_sr=ENF_TARGET_SR)

    # Need at least one STFT block length
    if len(audio) < ENF_STFT_NPERSEG:
        return {
            "enf_present": False,
            "dominant_grid_hz": None,
            "inferred_region": "absent",
            "enf_snr_db": 0.0,
            "enf_std_hz": 0.0,
            "enf_mean_drift_rate": 0.0,
            "enf_consistency_score": 0.0,
            "splice_detected": False,
            "splice_locations_sec": [],
            "enf_time_series": [],
            "enf_timestamps_sec": [],
            "flags": ["audio_too_short_for_enf"],
            "confidence": 0.0
        }

    trace_50, t_50, snr_50 = extract_enf(audio, ENF_HARMONICS_50, ENF_TARGET_SR)
    trace_60, t_60, snr_60 = extract_enf(audio, ENF_HARMONICS_60, ENF_TARGET_SR)
    
    flags = []
    
    if max(snr_50, snr_60) < ENF_SNR_THRESHOLD_DB:
        # ENF is completely absent
        return {
            "enf_present": False,
            "dominant_grid_hz": None,
            "inferred_region": "absent",
            "enf_snr_db": float(max(snr_50, snr_60)),
            "enf_std_hz": 0.0,
            "enf_mean_drift_rate": 0.0,
            "enf_consistency_score": 0.0,
            "splice_detected": False,
            "splice_locations_sec": [],
            "enf_time_series": [],
            "enf_timestamps_sec": [],
            "flags": ["enf_absent"],
            "confidence": 0.9
        }
        
    if snr_50 > snr_60:
        dominant_trace = trace_50
        timestamps = t_50
        dominant_snr = snr_50
        grid_hz = 50
        region = "50Hz_grid"
    else:
        dominant_trace = trace_60
        timestamps = t_60
        dominant_snr = snr_60
        grid_hz = 60
        region = "60Hz_grid"
        
    std_hz = float(np.std(dominant_trace))
    if len(dominant_trace) > 1:
        drift_rate = float(np.mean(np.abs(np.diff(dominant_trace)) / np.diff(timestamps)))
    else:
        drift_rate = 0.0
        
    # Consistency Logic
    if std_hz < ENF_FLAT_STD_THRESHOLD:
        consistency_score = 0.0
        flags.append("unnaturally_flat_enf")
    else:
        # Real grid usually has std of 0.02 to 0.1
        # Interpolate a score giving high score to 0.02 - 0.1 range
        if 0.02 <= std_hz <= 0.15:
            consistency_score = 1.0
        elif 0.005 <= std_hz < 0.02:
            consistency_score = (std_hz - 0.005) / 0.015
        else:
            consistency_score = max(0.0, 1.0 - ((std_hz - 0.15) / 0.2))

    splice_detected, splices = _detect_splice(dominant_trace, timestamps)
    if splice_detected:
        flags.append("enf_splice_discontinuity_detected")
        
    return {
        "enf_present": True,
        "dominant_grid_hz": grid_hz,
        "inferred_region": region,
        "enf_snr_db": float(dominant_snr),
        "enf_std_hz": float(std_hz),
        "enf_mean_drift_rate": float(drift_rate),
        "enf_consistency_score": float(consistency_score),
        "splice_detected": splice_detected,
        "splice_locations_sec": splices,
        "enf_time_series": dominant_trace.tolist(),
        "enf_timestamps_sec": timestamps.tolist(),
        "flags": flags,
        "confidence": min(1.0, dominant_snr / 30.0)  # Map 30dB+ to 1.0 confidence
    }
