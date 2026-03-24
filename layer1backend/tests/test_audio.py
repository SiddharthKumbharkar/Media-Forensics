import json
import sys
from audio_forensics import analyze_audio

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_audio.py <file_path>")
        sys.exit(1)
        
    path = sys.argv[1]
    try:
        result = analyze_audio(path)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error during analysis: {e}")

if __name__ == "__main__":
    main()
