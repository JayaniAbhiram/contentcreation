import os
import subprocess
import requests
import json
import logging
import tempfile
from pathlib import Path
from app.core.supabase import supabase
from app.services import lip_sync

logger = logging.getLogger(__name__)

def generate_srt(media_plan: list):
    """
    Generates a simple SRT subtitle file from the media plan segments.
    Uses the 'text' field (script segments) for actual subtitles.
    """
    srt_content = ""
    for i, item in enumerate(media_plan):
        start = item["start_time"]
        end = item["end_time"]
        text = item.get("text", item["keyword"]) # Use script segment if available
        
        # Convert seconds to SRT timestamp format 00:00:00,000
        def to_srt_time(seconds):
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            s = int(seconds % 60)
            ms = int((seconds * 1000) % 1000)
            return f"{h:02}:{m:02}:{s:02},{ms:03}"
        
        srt_content += f"{i+1}\n"
        srt_content += f"{to_srt_time(start)} --> {to_srt_time(end)}\n"
        srt_content += f"{text}\n\n"
    return srt_content

async def render_video(job_id: str, user_id: str, metadata: dict):
    """
    The main rendering pipeline.
    """
    media_plan = metadata.get("media_plan", {}).get("plan", [])
    audio_url = metadata.get("audio", {}).get("public_url")
    if not isinstance(audio_url, str):
        audio_url = audio_url.get("publicUrl") if audio_url else None
        
    if not media_plan or not audio_url:
        return {"status": "error", "message": "Missing media plan or audio"}

    # 0. Fetch User Settings for Avatar/Bubble
    settings_resp = supabase.table("user_settings").select("*").eq("user_id", user_id).single().execute()
    settings = settings_resp.data if settings_resp.data else {}
    selfie_path = settings.get("selfie_path")
    demo_video_path = settings.get("demo_video_path")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        # 1. Download Audio
        audio_file = tmp_path / "audio.mp3"
        resp = requests.get(audio_url)
        with open(audio_file, "wb") as f: f.write(resp.content)
        
        # 2. Download Media Assets
        asset_files = []
        for i, item in enumerate(media_plan):
            ext = ".mp4" if item["media"]["type"] == "video" else ".jpg"
            file_path = tmp_path / f"asset_{i}{ext}"
            resp = requests.get(item["media"]["url"])
            with open(file_path, "wb") as f: f.write(resp.content)
            asset_files.append({
                "path": str(file_path),
                "duration": item["end_time"] - item["start_time"],
                "type": item["media"]["type"]
            })
            
        # 3. Download Presenter Assets
        bubble_file = None
        bubble_type = None
        if demo_video_path and selfie_path:
            # Prefer video avatar if both present
            bubble_file = tmp_path / "presenter_demo.mp4"
            try:
                res = supabase.storage.from_("user-demo-videos").download(demo_video_path)
                with open(bubble_file, "wb") as f: f.write(res)
                bubble_type = "video"
            except: 
                bubble_file = None # Fallback
        
        if not bubble_file and selfie_path:
            bubble_file = tmp_path / "presenter_selfie.jpg"
            try:
                res = supabase.storage.from_("user-images").download(selfie_path)
                with open(bubble_file, "wb") as f: f.write(res)
                bubble_type = "image"
            except:
                bubble_file = None

        # 3.5 AI Lip Sync Enhancement (Free/Local)
        # User requested to try the static image (selfie) for better sync
        if selfie_path:
            logger.info("Enhancing Presenter Lip Sync using Static Image...")
            synced_bubble = tmp_path / "presenter_synced.mp4"
            
            # Download the selfie image specifically for lip sync
            selfie_file = tmp_path / "selfie_for_sync.jpg"
            try:
                res = supabase.storage.from_("user-images").download(selfie_path)
                with open(selfie_file, "wb") as f: f.write(res)
                
                await lip_sync.sync_vocals_to_video(str(selfie_file), str(audio_file), str(synced_bubble))
                bubble_file = synced_bubble
                bubble_type = "video" # It's now a video
                logger.info("Lip Sync from Image Success!")
            except Exception as e:
                logger.error(f"Lip Sync from image failed: {e}. Falling back to default bubble logic.")
        elif bubble_file and bubble_type == "video":
            logger.info("Enhancing Presenter Lip Sync using Demo Video...")
            synced_bubble = tmp_path / "presenter_synced.mp4"
            try:
                await lip_sync.sync_vocals_to_video(str(bubble_file), str(audio_file), str(synced_bubble))
                bubble_file = synced_bubble
                logger.info("Lip Sync Success!")
            except Exception as e:
                logger.error(f"Lip Sync failed: {e}. Falling back to original video.")

        # 3. Generate SRT
        srt_file = tmp_path / "subs.srt"
        with open(srt_file, "w") as f: f.write(generate_srt(media_plan))
        
        # 4. Build FFmpeg Command
        output_video = tmp_path / "final.mp4"
        
        # Determine Resolution based on duration
        # <= 30s -> Vertical (9:16), else -> Horizontal (16:9)
        total_duration = sum(asset["duration"] for asset in asset_files)
        is_vertical = total_duration <= 35 # Allowing a small buffer
        width, height = (1080, 1920) if is_vertical else (1920, 1080)
        
        # We'll use a filter_complex approach for scaling and transitions
        inputs = []
        filter_complex = ""
        for i, asset in enumerate(asset_files):
            inputs.extend(["-t", str(asset["duration"]), "-i", asset["path"]])
            
            if asset["type"] == "image":
                # Ken Burns effect with dynamic aspect ratio support
                # We scale to fill the target resolution then zoom
                filter_complex += (
                    f"[{i}:v]scale=iw*max({width}/iw\\,{height}/ih):ih*max({width}/iw\\,{height}/ih),"
                    f"crop={width}:{height},zoompan=z='min(zoom+0.001,1.5)':d={int(asset['duration']*25)}:"
                    f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height},setsar=1[v{i}];"
                )
            else:
                # Video: Scale and pad to fit target resolution (Horizontal or Vertical)
                filter_complex += (
                    f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                    f"setsar=1,fps=25[v{i}];"
                )
            
        # Concatenate visuals
        v_stream_names = "".join([f"[v{i}]" for i in range(len(asset_files))])
        filter_complex += f"{v_stream_names}concat=n={len(asset_files)}:v=1:a=0[v_base];"
        
        # Add subtitles with specific user requirements
        font_size = 12
        margin_v = 15
        
        abs_srt_path = os.path.abspath(srt_file).replace("'", "'\\''")
        filter_complex += (
            f"[v_base]subtitles=filename='{abs_srt_path}':"
            f"force_style='FontSize={font_size},PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=1,Alignment=2,MarginV={margin_v}'[v_subbed];"
        )

        # 4.5 Add Presenter Bubble if assets exist
        if bubble_file:
            bubble_idx = len(asset_files) + 1 # Audio is len(asset_files), bubble is next
            # Bubble size: 350 for horizontal, 300 for vertical to avoid clutter
            bubble_size = 300 if is_vertical else 350
            radius = bubble_size / 2
            
            # Prepare bubble visuals: crop to square -> circular mask -> scale
            filter_complex += (
                f"[{bubble_idx}:v]scale={bubble_size}:{bubble_size}:force_original_aspect_ratio=increase,crop={bubble_size}:{bubble_size},"
                f"format=yuva420p,geq=lum='p(X,Y)':a='if(gt(sqrt(pow(X-{radius},2)+pow(Y-{radius},2)),{radius}),0,255)'[bubble];"
            )
            
            # Overlay bubble: Top-right for vertical, Bottom-right for horizontal
            overlay_x = "main_w-overlay_w-50"
            overlay_y = "50" if is_vertical else "main_h-overlay_h-50"
            
            filter_complex += f"[v_subbed][bubble]overlay={overlay_x}:{overlay_y}[v_final]"
        else:
            filter_complex += "[v_subbed]copy[v_final]"

        cmd = [
            "ffmpeg", "-y",
            "-r", "25", # Set input framerate for images
            *inputs,
            "-i", str(audio_file)
        ]

        if bubble_file:
            if bubble_type == "video":
                # Loop video to cover main duration
                cmd.extend(["-stream_loop", "-1", "-i", str(bubble_file)])
            else:
                cmd.extend(["-i", str(bubble_file)])

        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[v_final]",
            "-map", f"{len(asset_files)}:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
            "-r", "25", # Ensure output is 25fps
            "-shortest",
            str(output_video)
        ])
        
        logger.info(f"Running FFmpeg for job {job_id}")
        process = subprocess.run(cmd, capture_output=True, text=True)
        
        if process.returncode != 0:
            logger.error(f"FFmpeg failed: {process.stderr}")
            return {"status": "error", "message": "FFmpeg rendering failed"}
            
        # 5. Upload to Supabase
        storage_path = f"{user_id}/{job_id}/final_video.mp4"
        with open(output_video, "rb") as f:
            supabase.storage.from_("job-assets").upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "video/mp4", "x-upsert": "true"}
            )
            
        # 4.5 Save a persistent local copy for Telegram delivery
        persistent_local_path = f"outputs/videos/{job_id}.mp4"
        import shutil
        shutil.copy2(str(output_video), persistent_local_path)
            
        try:
            # Use signed URL (valid for 1 week) to bypass privacy restrictions
            signed_resp = supabase.storage.from_("job-assets").create_signed_url(storage_path, 604800)
            public_url = signed_resp.get("signedURL") or signed_resp.get("signedUrl") if isinstance(signed_resp, dict) else signed_resp
        except Exception as e:
            logger.warning(f"Signed URL failed, falling back to public URL: {e}")
            public_url = supabase.storage.from_("job-assets").get_public_url(storage_path)
        
        return {
            "status": "success",
            "storage_path": storage_path,
            "public_url": public_url,
            "local_path": persistent_local_path
        }
