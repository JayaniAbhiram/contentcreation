import re
import edge_tts
import asyncio
import os
import logging
import subprocess
from app.core.supabase import supabase

logger = logging.getLogger(__name__)

async def process_audio_generation(job_id: str, script_text: str, user_id: str, duration_seconds: int):
    """
    Generates audio and tracks exact timing for each sentence.
    """
    # 1. Fetch User Settings
    settings_resp = supabase.table("user_settings").select("*").eq("user_id", user_id).single().execute()
    settings = settings_resp.data if settings_resp.data else {}
    
    # 2. Split into sentences and clean markers
    # We want to keep the segments so we can track their duration
    # Regex to split by . ! ? while keeping markers for the AI's internal reading
    raw_segments = re.split(r'([.!?])', script_text)
    segments = []
    for i in range(0, len(raw_segments)-1, 2):
        text = (raw_segments[i] + raw_segments[i+1]).strip()
        if text: segments.append(text)
    if len(raw_segments) % 2 != 0 and raw_segments[-1].strip():
        segments.append(raw_segments[-1].strip())

    eleven_key = os.getenv("ELEVENLABS_API_KEY")
    voice_to_use = "en-US-AndrewNeural" # Fallback
    mode = "generic"
    if eleven_key: mode = "personal_voice"

    sentence_timings = []
    temp_files = []
    
    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=eleven_key) if eleven_key else None
        
        for i, seg in enumerate(segments):
            # Clean markers for the actual TTS
            clean_seg = re.sub(r'\[.*?\]|\*\*.*?\*\*', '', seg).strip()
            clean_seg = clean_seg.replace("*", "")
            if not clean_seg: continue
            
            seg_filename = f"seg_{job_id}_{i}.mp3"
            
            if client:
                try:
                    audio_stream = client.text_to_speech.convert(
                        voice_id="pNInz6obpgDQGcFmaJgB", # Adam
                        text=clean_seg,
                        model_id="eleven_multilingual_v2",
                        output_format="mp3_44100_128"
                    )
                    with open(seg_filename, "wb") as f:
                        for chunk in audio_stream: f.write(chunk)
                except Exception as e:
                    if "quota_exceeded" in str(e).lower() or "401" in str(e):
                        logger.warning(f"ElevenLabs Quota Exceeded. Falling back to free engine for segment {i}.")
                        communicate = edge_tts.Communicate(clean_seg, "en-US-AndrewNeural")
                        await communicate.save(seg_filename)
                    else:
                        raise e
            else:
                communicate = edge_tts.Communicate(clean_seg, "en-US-AndrewNeural")
                await communicate.save(seg_filename)
            
            # Get duration of this segment
            dur = 0.0
            try:
                probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", seg_filename]
                dur = float(subprocess.check_output(probe_cmd).decode().strip())
            except: dur = 2.0 # Fallback
            
            sentence_timings.append({"text": clean_seg, "duration": dur})
            temp_files.append(seg_filename)

        # 3. Concatenate all segments into one voiceover
        final_audio = f"audio_{job_id}.mp3"
        # Create a concat list for FFmpeg
        list_file = f"list_{job_id}.txt"
        with open(list_file, "w") as f:
            for tf in temp_files:
                f.write(f"file '{os.path.abspath(tf)}'\n")
        
        subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", final_audio])
        
        # 4. Upload to Supabase
        storage_path = f"{user_id}/{job_id}/voiceover.mp3"
        with open(final_audio, "rb") as f:
            supabase.storage.from_("job-assets").upload(path=storage_path, file=f, file_options={"content-type": "audio/mpeg", "x-upsert": "true"})
        
        # 5. Get Public URL (Signed for Private Bucket)
        try:
            signed_resp = supabase.storage.from_("job-assets").create_signed_url(storage_path, 604800)
            public_url = signed_resp.get("signedURL") or signed_resp.get("signedUrl") if isinstance(signed_resp, dict) else signed_resp
        except Exception as e:
            logger.warning(f"Audio Signed URL failed: {e}")
            public_url = supabase.storage.from_("job-assets").get_public_url(storage_path)
            if isinstance(public_url, dict): public_url = public_url.get('publicUrl')
        
        # Cleanup
        for tf in temp_files: 
            if os.path.exists(tf): os.remove(tf)
        if os.path.exists(list_file): os.remove(list_file)
        if os.path.exists(final_audio): os.remove(final_audio)
        
        return {
            "status": "success",
            "voice": "ElevenLabs Adam" if eleven_key else "AndrewNeural",
            "storage_path": storage_path,
            "public_url": public_url,
            "sentence_timings": sentence_timings,
            "actual_duration": sum(s["duration"] for s in sentence_timings)
        }
        
    except Exception as e:
        logger.error(f"TTS Sync Error: {e}")
        return {"status": "error", "message": str(e)}
        
    except Exception as e:
        logger.error(f"TTS Error: {e}")
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        return {"status": "error", "message": str(e)}
