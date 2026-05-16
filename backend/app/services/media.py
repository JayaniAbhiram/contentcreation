import os
import requests
import logging
import re
import random
from mistralai.client import Mistral
from app.core.supabase import supabase

logger = logging.getLogger(__name__)

def get_keywords_from_script(script_text: str, count: int, improve: bool = False):
    """
    Uses Mistral to extract highly visual keywords.
    """
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        return ["technology", "innovation", "future"] * (count // 3 + 1)

    client = Mistral(api_key=api_key)
    # Strip existing markers for keyword analysis
    clean_script = re.sub(r'\[.*?\]', '', script_text).strip()
    
    improve_instruction = ""
    if improve:
        improve_instruction = "The previous visuals were not relevant enough. Focus on HIGHLY SPECIFIC, cinematic, and literal visual metaphors for each sentence."

    prompt = f"""
    Analyze this video script and provide exactly {count} visually descriptive search terms. 
    Terms should be specific to the concepts in the script.
    {improve_instruction}
    Avoid abstract words. Use concrete visual nouns (e.g. "high speed train", "cybersecurity code on screen", "busy stock market").
    Output ONLY the terms, separated by commas.
    
    Script:
    {clean_script}
    """
    
    try:
        response = client.chat.complete(
            model="mistral-large-latest",
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.choices[0].message.content.strip()
        keywords = [k.strip() for k in text.split(",")]
        while len(keywords) < count:
            keywords.append("cinematic background")
        return keywords[:count]
    except Exception as e:
        logger.error(f"Keyword extraction error: {e}")
        return ["cinematic"] * count

def search_pexels(query: str, per_page: int = 1):
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key: return []
    
    headers = {"Authorization": api_key}
    # Use a random page for variety if re-generating
    page = random.randint(1, 5)
    
    try:
        v_url = f"https://api.pexels.com/videos/search?query={query}&per_page={per_page}&page={page}"
        v_resp = requests.get(v_url, headers=headers).json()
        videos = v_resp.get("videos", [])
        if videos:
            return [{"type": "video", "url": v["video_files"][0]["link"], "preview": v["image"]} for v in videos]
        
        i_url = f"https://api.pexels.com/v1/search?query={query}&per_page={per_page}&page={page}"
        i_resp = requests.get(i_url, headers=headers).json()
        images = i_resp.get("photos", [])
        return [{"type": "image", "url": i["src"]["large2x"], "preview": i["src"]["medium"]} for i in images]
    except:
        return []

def search_pixabay(query: str, anime_style: bool):
    api_key = os.getenv("PIXABAY_API_KEY")
    if not api_key: return []
    
    q = query
    if anime_style:
        q = f"{query} illustration"
    
    page = random.randint(1, 3)
        
    try:
        url = f"https://pixabay.com/api/?key={api_key}&q={q}&image_type=photo&per_page=3&page={page}"
        resp = requests.get(url).json()
        hits = resp.get("hits", [])
        return [{"type": "image", "url": h["largeImageURL"], "preview": h["webformatURL"]} for h in hits]
    except:
        return []

def segment_script_for_subtitles(script_text: str, count: int):
    """
    Splits the script into segments and strips emotional markers.
    Returns a list of clean text segments.
    """
    # 1. Strip ALL emotional markers for the subtitles
    # This removes anything in ** ** or [ ] including the content
    clean_text = re.sub(r'\[.*?\]', '', script_text)
    clean_text = re.sub(r'\*\*.*?\*\*', '', clean_text)
    # Remove any lingering asterisks
    clean_text = clean_text.replace("*", "").strip()
    
    words = clean_text.split()
    if not words: return [""] * count
    
    avg = len(words) // count
    segments = []
    for i in range(count):
        start = i * avg
        end = (i + 1) * avg if i < count - 1 else len(words)
        segments.append(" ".join(words[start:end]))
    return segments

async def generate_media_plan(job_id: str, script_text: str, duration_seconds: int, user_id: str, improve: bool = False):
    # 0. Fetch Sentence Timings from Audio Metadata
    job_resp = supabase.table("jobs").select("metadata").eq("id", job_id).single().execute()
    metadata = job_resp.data.get("metadata", {})
    sentence_timings = metadata.get("audio", {}).get("sentence_timings", [])
    
    # 1. Determine number of placements
    # If we have sentence timings, we use those as the primary segments!
    if sentence_timings:
        count = len(sentence_timings)
    else:
        if duration_seconds <= 30: count = 10
        elif duration_seconds <= 120: count = 15
        else: count = 40
    
    # 2. Get User Settings
    settings_resp = supabase.table("user_settings").select("*").eq("user_id", user_id).single().execute()
    anime_style = settings_resp.data.get("anime_style_enabled", False) if settings_resp.data else False
    
    # 3. Get Keywords
    # We want one keyword per sentence if sentence_timings exist
    keywords = get_keywords_from_script(script_text, count, improve=improve)
    
    # 4. Build Plan with Guaranteed Sync
    plan = []
    current_time = 0.0
    fallbacks = ["technology", "urban", "nature", "modern", "abstract", "cinematic"]
    
    for i in range(count):
        kw = keywords[i]
        # Use sentence text and duration if available, otherwise fallback to word-count
        if sentence_timings:
            segment_text = sentence_timings[i]["text"]
            duration = sentence_timings[i]["duration"]
        else:
            # Fallback (should not happen if voiceover is generated)
            segment_text = "..."
            duration = duration_seconds / count
            
        media = []
        media = search_pexels(kw)
        if not media:
            media = search_pixabay(kw, anime_style)
        
        if not media:
            fallback_kw = random.choice(fallbacks)
            media = search_pexels(fallback_kw)
            if not media:
                media = [{"type": "image", "url": "https://images.pexels.com/photos/395196/pexels-photo-395196.jpeg", "preview": ""}]
        
        plan.append({
            "start_time": current_time,
            "end_time": current_time + duration,
            "keyword": kw,
            "text": segment_text,
            "media": media[0]
        })
        current_time += duration
        
    return {
        "status": "success",
        "count": len(plan),
        "plan": plan
    }
