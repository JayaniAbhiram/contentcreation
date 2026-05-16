import os
import logging
import httpx
import random
import urllib.parse
import asyncio
from PIL import Image, ImageEnhance, ImageOps, ImageDraw, ImageFilter
import io

logger = logging.getLogger(__name__)

async def generate_thumbnails(job_id: str, script_text: str, title: str, user_id: str = None):
    """
    Generates 3 professionally edited YouTube thumbnails with a user avatar overlay.
    """
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        return {"status": "error", "message": "PEXELS_API_KEY not found."}

    try:
        from app.core.supabase import supabase
        logger.info(f"Generating thumbnails for job {job_id} (User: {user_id})")
        
        # 1. Fetch User Avatar if available
        avatar_img = None
        if user_id:
            try:
                profile_res = supabase.table("profiles").select("avatar_url").eq("id", user_id).single().execute()
                avatar_url = profile_res.data.get("avatar_url") if profile_res.data else None
                
                if avatar_url:
                    logger.info(f"Fetching avatar: {avatar_url}")
                    async with httpx.AsyncClient() as client:
                        a_resp = await client.get(avatar_url, timeout=10.0)
                        if a_resp.status_code == 200:
                            avatar_img = Image.open(io.BytesIO(a_resp.content)).convert("RGBA")
                            # Circle crop the avatar
                            size = (180, 180)
                            avatar_img = avatar_img.resize(size, Image.LANCZOS)
                            mask = Image.new('L', size, 0)
                            draw = ImageDraw.Draw(mask)
                            draw.ellipse((0, 0) + size, fill=255)
                            avatar_img.putalpha(mask)
            except Exception as e:
                logger.error(f"Avatar processing failed: {e}")

        # 2. Search for high-quality background images
        stop_words = {'a', 'the', 'is', 'at', 'in', 'on', 'with', 'and', 'for', 'to', 'of'}
        words = [w for w in title.lower().split() if w not in stop_words and len(w) > 2]
        search_query = urllib.parse.quote(" ".join(words[:4]))
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": api_key}
            url = f"https://api.pexels.com/v1/search?query={search_query}&per_page=15"
            resp = await client.get(url, headers=headers)
            data = resp.json()
            photos = data.get("photos", [])
            
            if not photos:
                url = "https://api.pexels.com/v1/search?query=cinematic breaking news&per_page=15"
                resp = await client.get(url, headers=headers)
                photos = resp.json().get("photos", [])

            selected_photos = random.sample(photos, min(3, len(photos)))
            thumbnails = []
            
            for i, photo in enumerate(selected_photos):
                logger.info(f"Processing variation {i+1} from Pexels")
                img_resp = await client.get(photo["src"]["large2x"])
                if img_resp.status_code == 200:
                    img = Image.open(io.BytesIO(img_resp.content)).convert("RGB")
                    
                    # --- DRAMATIC VIRAL EDITING ---
                    img = ImageEnhance.Color(img).enhance(1.5)
                    img = ImageEnhance.Contrast(img).enhance(1.2)
                    img = ImageEnhance.Sharpness(img).enhance(1.5)
                    
                    # Add Vignette Overlay (Darker edges)
                    width, height = img.size
                    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                    draw = ImageDraw.Draw(overlay)
                    draw.rectangle([0, 0, width, height], outline=(0, 0, 0, 100), width=100)
                    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

                    # --- AVATAR OVERLAY ---
                    if avatar_img:
                        margin = 30
                        pos = (width - avatar_img.width - margin, height - avatar_img.height - margin)
                        
                        # White glow behind avatar
                        glow = Image.new('RGBA', (avatar_img.width + 12, avatar_img.height + 12), (255, 255, 255, 0))
                        g_draw = ImageDraw.Draw(glow)
                        g_draw.ellipse((0, 0, glow.width, glow.height), fill=(255, 255, 255, 180))
                        
                        img_rgba = img.convert("RGBA")
                        img_rgba.paste(glow, (pos[0]-6, pos[1]-6), glow)
                        img_rgba.paste(avatar_img, pos, avatar_img)
                        img = img_rgba.convert("RGB")
                    
                    # Save and Upload
                    img_byte_arr = io.BytesIO()
                    img.save(img_byte_arr, format='JPEG', quality=85) # Lower quality slightly for speed
                    image_data = img_byte_arr.getvalue()
                    
                    file_name = f"thumbnails/{job_id}/v_{i+1}_{os.urandom(2).hex()}.jpg"
                    logger.info(f"Uploading to Supabase: {file_name}")
                    supabase.storage.from_("job-assets").upload(
                        file_name,
                        image_data,
                        {"content-type": "image/jpeg"}
                    )
                    
                    res = supabase.storage.from_("job-assets").get_public_url(file_name)
                    # Handle both older and newer SDK return types
                    public_url = res if isinstance(res, str) else (getattr(res, 'public_url', None) or getattr(res, 'publicURL', None) or str(res))
                    thumbnails.append(public_url)

            return {"status": "success", "thumbnails": thumbnails}

    except Exception as e:
        logger.error(f"Branded Thumbnail Error: {e}")
        return {"status": "error", "message": f"Branding Error: {str(e)}"}
