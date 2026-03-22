import numpy as np
from typing import Optional

def generate_synthetic_enf_reference(
    duration_sec: float, 
    grid_hz: int = 50, 
    sr: int = 8000, 
    drift_std: float = 0.05
) -> np.ndarray:
    """
    Generates a synthetic ENF reference signal for testing or simulation.
    
    Args:
        duration_sec (float): Duration of the reference signal in seconds.
        grid_hz (int): Base frequency, typically 50 or 60.
        sr (int): Target sample rate.
        drift_std (float): Standard deviation of the random walk for drift.
        
    Returns:
        np.ndarray: Synthetic ENF trace (1D array) sampled at STFT frame rate.
    """
    # Assuming STFT parameters used in enf_analyzer: nperseg=8192, noverlap=7168
    # Step size is 8192 - 7168 = 1024 samples.
    # Frame rate = sr / 1024 -> ~7.8 frames / sec
    frames_per_sec = sr / (8192 - 7168)
    num_frames = int(duration_sec * frames_per_sec)
    
    # Generate random walk for drift
    drifts = np.random.normal(0, drift_std * 0.1, num_frames)
    trace = np.cumsum(drifts)
    
    # Center around grid_hz
    trace = trace - np.mean(trace) + grid_hz
    
    return trace
