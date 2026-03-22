import os
import tempfile
import numpy as np
import scipy.signal as signal
import soundfile as sf
import pytest
from audio_forensics import analyze_audio

def _generate_real_audio(duration=10.0, sr=22050):
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Speech-like with F0 150 Hz + harmonics
    f0 = 150.0
    audio = np.zeros_like(t)
    
    # Add jitter to F0
    jitter = 1.0 + 0.005 * np.random.randn(len(t))
    phase = 2 * np.pi * np.cumsum(f0 * jitter) / sr
    
    for h in range(1, 10):
        audio += (1.0 / h) * np.sin(h * phase)
        
    # Add 50Hz ENF Tone at -20dB (amplitude ratio 0.1)
    enf_tone = 0.1 * np.sin(2 * np.pi * 50.0 * t)
    audio += enf_tone
    
    # Mild reverb
    ir_len = int(sr * 0.5)
    ir_t = np.linspace(0, 0.5, ir_len)
    ir = np.exp(-10 * ir_t) * np.random.randn(ir_len)
    audio = signal.convolve(audio, ir, mode='same')
    
    # Normalize
    audio = audio / np.max(np.abs(audio))
    return audio, sr

def _generate_synthetic_audio(duration=10.0, sr=22050):
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    f0 = 150.0
    audio = np.zeros_like(t)
    
    # Perfectly periodic, no jitter
    phase = 2 * np.pi * f0 * t
    for h in range(1, 10):
        audio += (1.0 / h) * np.sin(h * phase)
        
    # No ENF, No Reverb
    audio = audio / np.max(np.abs(audio))
    return audio, sr

def test_real_audio():
    audio, sr = _generate_real_audio(duration=10.0)
    
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        sf.write(path, audio, sr)
        result = analyze_audio(path)
        
        # Test basic requirements
        assert result["enf_analysis"]["enf_present"] == True
        # Real audio might still be tricky to get > 0.5 just with sines, 
        # but the test checks if fusion logic evaluates inputs
        # The prompt requires: Assert authenticity_score > 0.5
        assert result["authenticity_score"] > 0.5
    finally:
        os.remove(path)

def test_synthetic_audio():
    audio, sr = _generate_synthetic_audio(duration=10.0)
    
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        sf.write(path, audio, sr)
        result = analyze_audio(path)
        
        assert result["enf_analysis"]["enf_present"] == False
        # Assert authenticity score < 0.5
        assert result["authenticity_score"] < 0.5
    finally:
        os.remove(path)

def test_too_short():
    audio, sr = _generate_synthetic_audio(duration=0.2)
    
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        sf.write(path, audio, sr)
        result = analyze_audio(path)
        
        assert result["final_verdict"] == "INCONCLUSIVE"
        assert result["error"] == "audio_too_short"
    finally:
        os.remove(path)

def test_video_file():
    ffmpeg = pytest.importorskip("ffmpeg")
    
    # Generate a small valid mp4 video with audio using ffmpeg directly
    video_path = tempfile.mktemp(suffix=".mp4")
    try:
        # Create a dummy 1 sec video with testsrc and sine audio
        (
            ffmpeg
            .input('testsrc=duration=1:size=128x128:rate=10', f='lavfi')
            .input('sine=frequency=440:duration=1', f='lavfi')
            .output(video_path, vcodec='libx264', acodec='aac')
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        
        result = analyze_audio(video_path)
        # 1 sec audio should proceed, might be inconclusive or synthetic based on sine
        assert result["error"] is None or result["error"] != "audio_too_short"
    finally:
        if os.path.exists(video_path):
            os.remove(video_path)
