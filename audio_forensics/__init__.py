from .pipeline import analyze_audio_pipeline

def analyze_audio(file_path: str) -> dict:
    """
    Accepts: absolute or relative path to an audio file
             Supported formats: .wav, .mp3, .flac, .ogg, .m4a, .aac
             For video files passed in, extract audio track first using ffmpeg.
    
    Returns: a dict matching the AudioForensicsResult schema (see schemas.py)
    """
    result = analyze_audio_pipeline(file_path)
    return dict(result)

__all__ = ["analyze_audio"]
