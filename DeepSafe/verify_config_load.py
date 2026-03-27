import sys
import os

# Add current directory to path so we can import deepsafe_utils
sys.path.append(os.getcwd())

from deepsafe_utils.config_manager import ConfigManager


def verify_config():
    cm = ConfigManager()
    if not cm.is_config_loaded_successfully():
        print("Failed to load config.")
        sys.exit(1)

    video_models = cm.get_model_endpoints("video")
    print(f"Configured Video Models: {list(video_models.keys())}")

    if "cross_efficient_vit" in video_models:
        print("SUCCESS: 'cross_efficient_vit' is found in video models configuration.")
    else:
        print("FAILURE: 'cross_efficient_vit' NOT found in video models configuration.")


if __name__ == "__main__":
    verify_config()
