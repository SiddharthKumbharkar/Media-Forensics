import numpy as np
import scipy.signal as signal
import librosa
from typing import Dict, Any, List, Tuple
from .audio_utils import is_speech_present, get_speech_segments, compute_snr

# --- Constants ---
GLOTTAL_TARGET_SR = 16000
MIN_OQ = 0.4
MAX_OQ = 0.7
MIN_ASYM = 2.0
MAX_ASYM = 4.0
MIN_RD = 0.3
MAX_RD = 2.8
MIN_SNR_DB = 5.0
MIN_SPEECH_SEC = 1.0

def _empty_glottal_response(note: str = "") -> Dict[str, Any]:
    return {
        "lpc_order_used": 0,
        "pulses_analyzed": 0,
        "oq_mean": 0.0,
        "oq_std": 0.0,
        "asymmetry_ratio_mean": 0.0,
        "asymmetry_ratio_std": 0.0,
        "rd_mean": 0.0,
        "rd_std": 0.0,
        "lf_model_deviation_score": 0.0,
        "glottal_naturalness_score": 0.0,
        "anomalies": [],
        "confidence": 0.0,
        "note": note
    }

def levinson_durbin(r: np.ndarray, order: int) -> np.ndarray:
    """Manually implements Levinson-Durbin recursion for LPC coefficients."""
    a = np.zeros(order + 1)
    e = np.zeros(order + 1)
    
    a[0] = 1.0
    e[0] = r[0]
    
    for i in range(1, order + 1):
        if e[i - 1] == 0:
            break
        acc = sum(a[j] * r[i - j] for j in range(1, i))
        k = (r[i] - acc) / e[i - 1]
        
        a_new = np.copy(a)
        for j in range(1, i):
            a_new[j] = a[j] - k * a[i - j]
            
        a_new[i] = k
        a = a_new
        e[i] = (1 - k * k) * e[i - 1]
        
    return a

def extract_glottal_pulses(audio: np.ndarray, sr: int) -> Tuple[np.ndarray, int]:
    """Inverse filters the audio to extract glottal derivative signal (GCI)."""
    # Pre-emphasis
    preemph = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])
    
    # LPC analysis
    lpc_order = int(sr / 1000) + 2
    frame_len = int(0.02 * sr)
    hop_len = int(0.01 * sr)
    
    glottal_signal = np.zeros_like(preemph)
    
    frames = librosa.util.frame(preemph, frame_length=frame_len, hop_length=hop_len)
    for i in range(frames.shape[1]):
        frame = frames[:, i] * np.hamming(frame_len)
        autocorr = librosa.autocorrelate(frame)
        
        # Calculate LPC coefficients via Levinson-Durbin
        if np.max(autocorr) > 1e-10:
            a = levinson_durbin(autocorr[:lpc_order+1], lpc_order)
            
            # Inverse filter
            start_idx = i * hop_len
            end_idx = min(start_idx + frame_len, len(glottal_signal))
            frame_actual = preemph[start_idx:end_idx]
            
            # Use lfilter directly
            inv_filtered = signal.lfilter([1.0], a, frame_actual)
            
            # Overlap-add approximation or simple replacement
            # Since speech waveforms change slowly, we can just replace
            # A true glottal flow extraction is complex, this is standard LPC residual
            glottal_signal[start_idx:end_idx] = inv_filtered
            
    return glottal_signal, lpc_order

def process_glottal_shape(glottal_signal: np.ndarray, sr: int) -> Dict[str, Any]:
    """Analyzes shape of glottal derivative pulses."""
    # Find negative peaks (GCIs)
    # Simple peak picking on negated signal
    neg_glot = -glottal_signal
    peaks, _ = signal.find_peaks(neg_glot, distance=int(sr/500)) # Max 500Hz
    
    oq_vals = []
    asym_vals = []
    rd_vals = []
    
    for i in range(len(peaks) - 1):
        gci1 = peaks[i]
        gci2 = peaks[i+1]
        cycle = glottal_signal[gci1:gci2]
        
        if len(cycle) < int(sr/800):
            continue
            
        # Opening phase length (from GCI to positive peak)
        # Closing phase (from pos peak to next GCI)
        pos_peak_idx = np.argmax(cycle)
        
        opening_samples = pos_peak_idx
        closing_samples = len(cycle) - pos_peak_idx
        
        if opening_samples == 0 or closing_samples == 0:
            continue
            
        # Oq (Open quotient approx)
        oq = opening_samples / len(cycle)
        # Asymmetry (Rise vs fall in the glottal derivative flow)
        asym = closing_samples / opening_samples
        # Rd parameter approx
        # Rd = (T0 / Tp) / 100 where Tp is time to peak
        t0 = len(cycle) / sr
        tp = opening_samples / sr
        rd = (t0 / tp) / 10.0 # Scaling for typical LF model range
        
        oq_vals.append(oq)
        asym_vals.append(asym)
        rd_vals.append(rd)
        
    return {
        "oq": oq_vals,
        "asym": asym_vals,
        "rd": rd_vals
    }

def run_glottal_analysis(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Analyzes glottal pulse shape via LPC inverse filtering to detect synthetic voices.
    
    Args:
        audio (np.ndarray): Mono audio array.
        sr (int): Original sample rate.
        
    Returns:
        Dict[str, Any]: Output matching the glottal section of schema.
    """
    if len(audio) == 0:
        return _empty_glottal_response(note="Empty audio array.")
        
    if sr != GLOTTAL_TARGET_SR:
        try:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=GLOTTAL_TARGET_SR)
        except Exception:
            return _empty_glottal_response(note="Resampling failed.")
        sr = GLOTTAL_TARGET_SR

    if not is_speech_present(audio, sr):
        return _empty_glottal_response(note="No voice/speech detected.")

    # Check speech duration
    segments = get_speech_segments(audio, sr)
    total_speech_samples = sum(end - start for start, end in segments)
    if total_speech_samples / sr < MIN_SPEECH_SEC:
        return _empty_glottal_response(note="Speech segments too short (< 1s).")

    # Check SNR
    snr_db = compute_snr(audio)
    if snr_db < MIN_SNR_DB:
        return _empty_glottal_response(note=f"SNR too low ({snr_db:.1f} dB < {MIN_SNR_DB} dB).")

    # Only process actual speech segments to avoid noise artifacts
    concatenated_speech = np.concatenate([audio[s:e] for s, e in segments])
    
    glottal_signal, lpc_order = extract_glottal_pulses(concatenated_speech, sr)
    metrics = process_glottal_shape(glottal_signal, sr)
    
    oq_vals = metrics["oq"]
    asym_vals = metrics["asym"]
    rd_vals = metrics["rd"]
    
    num_pulses = len(oq_vals)
    if num_pulses < 10:
        return _empty_glottal_response(note="Not enough valid glottal pulses extracted.")

    oq_mean = float(np.mean(oq_vals))
    oq_std = float(np.std(oq_vals))
    asym_mean = float(np.mean(asym_vals))
    asym_std = float(np.std(asym_vals))
    rd_mean = float(np.mean(rd_vals))
    rd_std = float(np.std(rd_vals))

    anomalies = []
    
    # LF Deviation Scoring
    deviation_components = []
    
    if not (MIN_OQ <= oq_mean <= MAX_OQ):
        anomalies.append(f"Oq out of range: {oq_mean:.2f}")
        deviation_components.append(1.0)
    else:
        deviation_components.append(0.0)
        
    if not (MIN_ASYM <= asym_mean <= MAX_ASYM):
        anomalies.append(f"Asymmetry out of range: {asym_mean:.2f}")
        deviation_components.append(1.0)
    else:
        deviation_components.append(0.0)
        
    if not (MIN_RD <= rd_mean <= MAX_RD):
        anomalies.append(f"Rd out of range: {rd_mean:.2f}")
        deviation_components.append(1.0)
    else:
        deviation_components.append(0.0)
        
    # Consistency 
    # Clones have very low variance
    if oq_std < 0.01:
        anomalies.append(f"Unnaturally consistent Oq (std: {oq_std:.4f})")
        deviation_components.append(1.0)
        
    deviation_score = float(np.mean(deviation_components))
    naturalness_score = 1.0 - deviation_score
    
    confidence = min(1.0, num_pulses / 200.0) # Full scale confidence with >200 pulses

    return {
        "lpc_order_used": lpc_order,
        "pulses_analyzed": num_pulses,
        "oq_mean": oq_mean,
        "oq_std": oq_std,
        "asymmetry_ratio_mean": asym_mean,
        "asymmetry_ratio_std": asym_std,
        "rd_mean": rd_mean,
        "rd_std": rd_std,
        "lf_model_deviation_score": deviation_score,
        "glottal_naturalness_score": naturalness_score,
        "anomalies": anomalies,
        "confidence": confidence,
        "note": "Analysis completed successfully."
    }
