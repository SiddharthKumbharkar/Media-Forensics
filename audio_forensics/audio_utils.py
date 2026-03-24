import os
import shutil
import numpy as np
import librosa
import ffmpeg
import tempfile
from typing import Tuple, List

try:
    import imageio_ffmpeg  # type: ignore
except Exception:
    imageio_ffmpeg = None


def _resolve_ffmpeg_binary() -> str:
    """Find an ffmpeg executable usable by ffmpeg-python."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        return ffmpeg_bin

    if imageio_ffmpeg is not None:
        try:
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            pass

    raise ValueError(
        "FFmpeg executable not found. Install ffmpeg (e.g., 'brew install ffmpeg') "
        "or install Python package 'imageio-ffmpeg'."
    )

def load_audio(file_path: str, target_sr: int = 22050) -> Tuple[np.ndarray, int]:
    """
    Loads an audio file and converts it to mono, resampled to target_sr.
    If the file is a video, extracts the audio track first via ffmpeg.
    
    Args:
        file_path (str): Path to the input file.
        target_sr (int): Desired sample rate (default 22050).
        
    Returns:
        Tuple[np.ndarray, int]: (audio array, sample rate)
        
    Raises:
        FileNotFoundError: If file_path does not exist.
        ValueError: If file is unsupported or ffmpeg extraction fails.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    ext = os.path.splitext(file_path)[1].lower()
    video_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    audio_exts = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}
    
    if ext not in video_exts and ext not in audio_exts:
        raise ValueError(f"Unsupported file format: {ext}")
        
    temp_wav_path = None
    if ext in video_exts:
        # Extract audio using ffmpeg
        fd, temp_wav_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        try:
            ffmpeg_cmd = _resolve_ffmpeg_binary()
            (
                ffmpeg
                .input(file_path)
                .output(temp_wav_path, vn=None, acodec='pcm_s16le', ac=1, ar=target_sr)
                .overwrite_output()
                .run(cmd=ffmpeg_cmd, capture_stdout=True, capture_stderr=True)
            )
            file_to_load = temp_wav_path
        except ffmpeg.Error as e:
            if temp_wav_path and os.path.exists(temp_wav_path):
                os.remove(temp_wav_path)
            raise ValueError(f"Failed to extract audio from video: {e.stderr.decode()}")
    else:
        file_to_load = file_path
        
    try:
        y, sr = librosa.load(file_to_load, sr=target_sr, mono=True)
        return y, sr
    except Exception as e:
        raise ValueError(f"Failed to load audio: {e}")
    finally:
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)

def compute_snr(signal: np.ndarray, noise_floor_percentile: int = 10) -> float:
    """
    Estimates SNR using a percentile-based noise floor method.
    
    Args:
        signal (np.ndarray): The mono audio array.
        noise_floor_percentile (int): Percentile to use as noise floor.
        
    Returns:
        float: Estimated SNR in dB.
    """
    if len(signal) == 0:
        return 0.0
    
    # Compute short-time energy
    frame_length = 2048
    hop_length = 512
    if len(signal) < frame_length:
        frame_length = len(signal)
        hop_length = max(1, frame_length // 4)
        
    energy = np.array([
        np.sum(signal[i:i+frame_length]**2)
        for i in range(0, len(signal), hop_length)
    ])
    
    if len(energy) == 0:
        return 0.0
        
    energy = np.maximum(energy, 1e-10) # Avoid log of zero
    
    signal_power = np.mean(energy)
    noise_power = np.percentile(energy, noise_floor_percentile)
    
    if noise_power <= 0:
        noise_power = 1e-10
        
    snr_db = 10 * np.log10(signal_power / noise_power)
    return float(snr_db)

def is_speech_present(audio: np.ndarray, sr: int) -> bool:
    """
    Detects if speech is actually present in the audio using energy thresholding and ZCR.
    
    Args:
        audio (np.ndarray): Mono audio array.
        sr (int): Sample rate.
        
    Returns:
        bool: True if speech is detected, False otherwise.
    """
    if len(audio) == 0:
        return False
        
    non_mute_intervals = librosa.effects.split(audio, top_db=30)
    if len(non_mute_intervals) == 0:
        return False
        
    # Check total non-mute duration
    total_non_mute_samples = sum(end - start for start, end in non_mute_intervals)
    if total_non_mute_samples / sr < 0.5:
        # Less than 0.5s of speech-like sound
        return False
        
    # Check ZCR for speech characteristics
    zcr = librosa.feature.zero_crossing_rate(audio)[0]
    mean_zcr = np.mean(zcr)
    
    # Simple heuristic: music/noise might have very high or very low ZCR
    if mean_zcr > 0.3 or mean_zcr < 0.01:
        return False
        
    return True

def get_speech_segments(audio: np.ndarray, sr: int) -> List[Tuple[int, int]]:
    """
    Finds starting and ending segment indices of speech in the audio.
    
    Args:
        audio (np.ndarray): Mono audio array.
        sr (int): Sample rate.
        
    Returns:
        List[Tuple[int, int]]: List of (start_sample, end_sample) tuples.
    """
    segments = librosa.effects.split(audio, top_db=20)
    return [(int(start), int(end)) for start, end in segments]

def normalize_audio(audio: np.ndarray) -> np.ndarray:
    """
    Peak normalizes the audio to [-1, 1].
    
    Args:
        audio (np.ndarray): Mono audio array.
        
    Returns:
        np.ndarray: Normalized audio.
    """
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        return audio / max_val
    return audio
