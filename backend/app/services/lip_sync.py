import os
import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent / "wav2lip_pkg"
CHECKPOINT_PATH = BASE_DIR / "checkpoints" / "wav2lip_gan.pth"
FACE_DETECTOR_PATH = BASE_DIR / "face_detection" / "detection" / "sfd" / "s3fd.pth"

async def sync_vocals_to_video(video_path: str, audio_path: str, output_path: str):
    """
    Runs Wav2Lip inference via subprocess.
    """
    # Ensure directories exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    os.makedirs(BASE_DIR / "temp", exist_ok=True)

    logger.info(f"Starting Real Lip Sync: {video_path} + {audio_path}")
    
    if not CHECKPOINT_PATH.exists() or os.path.getsize(CHECKPOINT_PATH) < 1000:
        logger.error(f"Checkpoint missing or invalid at {CHECKPOINT_PATH}")
        raise Exception("AI Model weights missing. Please check backend installation.")

    # Use venv python if available to ensure dependencies (numpy, torch) are found
    venv_python = Path(__file__).parent.parent.parent / "venv" / "bin" / "python"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable

    # Wav2Lip inference parameters
    cmd = [
        python_exe, str(BASE_DIR / "inference.py"),
        "--checkpoint_path", str(CHECKPOINT_PATH),
        "--face", video_path,
        "--audio", audio_path,
        "--outfile", output_path,
        "--resize_factor", "1" # Use full resolution for images for better quality
    ]
    
    try:
        env = os.environ.copy()
        env["PYTHONPATH"] = str(BASE_DIR) + os.pathsep + env.get("PYTHONPATH", "")
        
        logger.info(f"Executing: {' '.join(cmd)}")
        process = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd=str(BASE_DIR))
        
        if process.stdout:
            logger.info(f"Wav2Lip Output: {process.stdout}")
        
        if process.returncode != 0:
            logger.error(f"Wav2Lip Error Exit Code {process.returncode}")
            logger.error(f"Wav2Lip Stderr: {process.stderr}")
            raise Exception(f"Wav2Lip failed: {process.stderr}")
            
        logger.info(f"Lip Sync Completed Successfully: {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"Failed to run Wav2Lip: {e}")
        raise e
