import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel
from typing import Optional

import logging

load_dotenv()
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

class DurationRequest(BaseModel):
    duration_seconds: int

class TelegramVerifyRequest(BaseModel):
    token: str

class YouTubePublishRequest(BaseModel):
    title: str
    description: str
    privacy_status: str = "unlisted"
    thumbnail_url: Optional[str] = None

class LinkedInPublishRequest(BaseModel):
    title: str
    description: str
    visibility: str = "PUBLIC"

class TelegramSendRequest(BaseModel):
    caption: str

class LinkedInDescriptionRequest(BaseModel):
    theme: str
    enabled_platforms: Optional[list[str]] = ["telegram", "instagram", "linkedin", "facebook", "youtube"]

app = FastAPI(title="Article to Video API")
from app.core.supabase import supabase as supabase_admin
from app.services.extraction import extract_article
from app.services.scripting import generate_script, generate_linkedin_description
from app.services.video import render_video
from app.services.audio import process_audio_generation
from app.services.media import generate_media_plan
from app.services.thumbnail import generate_thumbnails
from app.services.telegram_service import send_video_for_review, handle_callback, send_video_to_telegram
from app.services.youtube_service import upload_video_to_youtube
from app.services.linkedin_service import upload_video_to_linkedin
from fastapi.responses import RedirectResponse

# Meta API Configuration
META_CLIENT_ID = os.getenv("META_CLIENT_ID")
META_CLIENT_SECRET = os.getenv("META_CLIENT_SECRET")
META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "http://localhost:8000/auth/instagram/callback")

logger = logging.getLogger(__name__)

@app.get("/auth/instagram/url")
async def get_instagram_auth_url(user_id: str):
    scopes = [
        "instagram_basic",
        "instagram_content_publish",
        "pages_show_list",
        "pages_read_engagement",
        "public_profile"
    ]
    url = (
        f"https://www.facebook.com/v19.0/dialog/oauth?"
        f"client_id={META_CLIENT_ID}&"
        f"redirect_uri={META_REDIRECT_URI}&"
        f"scope={','.join(scopes)}&"
        f"state={user_id}"
    )
    return {"url": url}

@app.get("/auth/instagram/callback")
async def instagram_callback(code: str, state: str):
    user_id = state
    
    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id": META_CLIENT_ID,
                "client_secret": META_CLIENT_SECRET,
                "redirect_uri": META_REDIRECT_URI,
                "code": code
            }
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            return {"status": "error", "message": "Failed to get access token"}

        # 2. Get Long-Lived Token (60 days)
        ll_resp = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": META_CLIENT_ID,
                "client_secret": META_CLIENT_SECRET,
                "fb_exchange_token": access_token
            }
        )
        ll_token = ll_resp.json().get("access_token")

        # 3. Find Instagram Business Account ID
        # A. Get User's Pages
        pages_resp = await client.get(
            f"https://graph.facebook.com/v19.0/me/accounts",
            params={"access_token": ll_token}
        )
        pages_data = pages_resp.json().get("data", [])
        
        ig_business_id = None
        for page in pages_data:
            page_id = page["id"]
            # Get IG account linked to this page
            ig_resp = await client.get(
                f"https://graph.facebook.com/v19.0/{page_id}",
                params={
                    "fields": "instagram_business_account",
                    "access_token": ll_token
                }
            )
            ig_data = ig_resp.json()
            if "instagram_business_account" in ig_data:
                ig_business_id = ig_data["instagram_business_account"]["id"]
                break
        
        if not ig_business_id:
            return {"status": "error", "message": "No Instagram Business Account found linked to your Facebook Pages."}

        # 4. Save to user_settings
        supabase_admin.table("user_settings").update({
            "instagram_access_token": ll_token,
            "instagram_business_account_id": ig_business_id
        }).eq("user_id", user_id).execute()

    return {"status": "success", "message": "Instagram connected successfully!"}

# Configure CORS for frontend access
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "https://articlo.vercel.app") # Replace with your Vercel URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "backend",
        "version": "0.1.0"
    }

# --- Admin Endpoints ---

@app.get("/admin/jobs")
async def admin_get_all_jobs(admin_id: str):
    # Security Check
    profile = supabase_admin.table("profiles").select("is_admin").eq("id", admin_id).single().execute()
    if not profile.data or not profile.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Fetch all jobs with user emails
    res = supabase_admin.table("jobs").select("*, profiles(email)").order("created_at", desc=True).execute()
    return res.data

@app.get("/admin/stats")
async def admin_get_stats(admin_id: str):
    profile = supabase_admin.table("profiles").select("is_admin").eq("id", admin_id).single().execute()
    if not profile.data or not profile.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Simple stats
    jobs_count = supabase_admin.table("jobs").select("id", count="exact").execute().count
    failed_count = supabase_admin.table("jobs").select("id", count="exact").eq("status", "failed").execute().count
    
    # Storage breakdown
    storage_res = supabase_admin.table("job_outputs").select("asset_type").execute()
    outputs = storage_res.data or []
    breakdown = {}
    for o in outputs:
        t = o["asset_type"]
        breakdown[t] = breakdown.get(t, 0) + 1
        
    return {
        "total_jobs": jobs_count,
        "failed_jobs": failed_count,
        "storage_files": breakdown
    }

@app.delete("/admin/jobs/{job_id}")
async def admin_delete_job(job_id: str, admin_id: str):
    profile = supabase_admin.table("profiles").select("is_admin").eq("id", admin_id).single().execute()
    if not profile.data or not profile.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # 1. Delete assets from storage
    outputs = supabase_admin.table("job_outputs").select("storage_path").eq("job_id", job_id).execute().data or []
    for output in outputs:
        try:
            # Determine bucket from asset_type or path (usually stored in metadata)
            # For simplicity, we try common buckets
            for bucket in ["generated-videos", "job-assets"]:
                supabase_admin.storage.from_(bucket).remove([output["storage_path"]])
        except:
            pass
            
    # 2. Delete from DB (Cascade will handle job_outputs)
    supabase_admin.table("jobs").delete().eq("id", job_id).execute()
    
    return {"status": "success", "message": "Job and assets deleted"}

@app.get("/supabase-test")
async def supabase_test():
    try:
        # Just try to fetch profiles to verify connection
        # This will work if service role key is correct
        response = supabase_admin.table("profiles").select("*").limit(1).execute()
        return {
            "status": "connected",
            "data": response.data
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.post("/jobs/{job_id}/extract")
async def trigger_extraction(job_id: str):
    # 1. Fetch job from Supabase
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    
    # 2. Update status to extracting
    supabase_admin.table("jobs").update({"status": "extracting"}).eq("id", job_id).execute()
    
    # 3. Extract
    result = extract_article(job["url"])
    
    if result["status"] == "success":
        # 4. Save metadata and update status to pending_duration
        supabase_admin.table("jobs").update({
            "status": "pending_duration",
            "metadata": {
                **job.get("metadata", {}),
                "extraction": result
            }
        }).eq("id", job_id).execute()
    else:
        # 5. Handle failure
        supabase_admin.table("jobs").update({
            "status": "failed",
            "error_message": result["message"],
            "metadata": {
                **job.get("metadata", {}),
                "extraction_error": result
            }
        }).eq("id", job_id).execute()
        
    return result

@app.post("/jobs/{job_id}/set-duration")
async def set_duration(job_id: str, request: DurationRequest):
    # Fetch job
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    
    # Update duration metadata but stay in pending_duration
    supabase_admin.table("jobs").update({
        "metadata": {
            **job.get("metadata", {}),
            "config": {
                "duration_seconds": request.duration_seconds
            }
        }
    }).eq("id", job_id).execute()
    
    return {"status": "success", "duration": request.duration_seconds}

@app.post("/jobs/{job_id}/confirm-config")
async def confirm_config(job_id: str):
    # Move to pending_script
    supabase_admin.table("jobs").update({
        "status": "pending_script"
    }).eq("id", job_id).execute()
    return {"status": "success"}

# YouTube OAuth Configuration
YOUTUBE_CLIENT_ID = os.getenv("YOUTUBE_CLIENT_ID")
YOUTUBE_CLIENT_SECRET = os.getenv("YOUTUBE_CLIENT_SECRET")
YOUTUBE_REDIRECT_URI = os.getenv("YOUTUBE_REDIRECT_URI")

LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI")

SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]

async def get_social_footer(user_id: str, enabled_platforms: list[str] = None) -> str:
    res = supabase_admin.table("user_settings").select("*").eq("user_id", user_id).single().execute()
    if not res.data:
        return ""
    
    if enabled_platforms is None:
        enabled_platforms = ["telegram", "instagram", "linkedin", "facebook", "youtube"]

    settings = res.data
    links = []
    if "telegram" in enabled_platforms and settings.get("telegram_channel_url"):
        links.append(f"📢 Telegram: {settings['telegram_channel_url']}")
    if "instagram" in enabled_platforms and settings.get("instagram_url"):
        links.append(f"📸 Instagram: {settings['instagram_url']}")
    if "linkedin" in enabled_platforms and settings.get("linkedin_page_url"):
        links.append(f"💼 LinkedIn: {settings['linkedin_page_url']}")
    if "facebook" in enabled_platforms and settings.get("facebook_page_url"):
        links.append(f"👥 Facebook: {settings['facebook_page_url']}")
    if "youtube" in enabled_platforms and settings.get("youtube_channel_url"):
        links.append(f"🎥 YouTube: {settings['youtube_channel_url']}")
    
    if not links:
        return ""
        
    return "🔗 Connect with us:\n" + "\n".join(links)

async def background_scripting_task(job_id: str, extraction_text: str, duration: int, social_footer: str, metadata: dict):
    try:
        from app.services.scripting import generate_script
        result = generate_script(extraction_text, duration, social_footer=social_footer)
        
        if result["status"] == "success":
            supabase_admin.table("jobs").update({
                "status": "pending_media",
                "metadata": {
                    **metadata,
                    "script": result
                }
            }).eq("id", job_id).execute()
        else:
            supabase_admin.table("jobs").update({
                "status": "failed",
                "error_message": result.get("message", "Script generation failed")
            }).eq("id", job_id).execute()
    except Exception as e:
        print(f"Background scripting crash: {e}")
        supabase_admin.table("jobs").update({
            "status": "failed",
            "error_message": f"Background scripting error: {str(e)}"
        }).eq("id", job_id).execute()

@app.post("/jobs/{job_id}/generate-script")
async def trigger_scripting(job_id: str, background_tasks: BackgroundTasks):
    # 1. Fetch job
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    extraction = job.get("metadata", {}).get("extraction")
    config = job.get("metadata", {}).get("config")
    user_id = job.get("user_id")
    
    if not extraction or not config:
        return {"status": "error", "message": "Article must be extracted and duration set before scripting."}
    
    # 2. Update status to scripting
    supabase_admin.table("jobs").update({"status": "scripting"}).eq("id", job_id).execute()
    
    # 3. Build social footer
    social_footer = await get_social_footer(user_id)
    
    # 4. Queue Task
    background_tasks.add_task(background_scripting_task, job_id, extraction["text"], config["duration_seconds"], social_footer, job.get("metadata", {}))
    
    return {"status": "success", "message": "Scripting started in background"}

async def background_audio_task(job_id: str, script_text: str, user_id: str, duration: int, metadata: dict):
    try:
        from app.services.audio import process_audio_generation
        result = await process_audio_generation(job_id, script_text, user_id, duration)
        
        if result["status"] == "success":
            supabase_admin.table("jobs").update({
                "status": "pending_media",
                "metadata": {
                    **metadata,
                    "audio": result
                }
            }).eq("id", job_id).execute()
        else:
            supabase_admin.table("jobs").update({
                "status": "failed",
                "error_message": result.get("message", "Audio generation failed")
            }).eq("id", job_id).execute()
    except Exception as e:
        print(f"Background audio crash: {e}")
        supabase_admin.table("jobs").update({
            "status": "failed",
            "error_message": f"Background audio error: {str(e)}"
        }).eq("id", job_id).execute()

@app.post("/jobs/{job_id}/generate-audio")
async def trigger_audio(job_id: str, background_tasks: BackgroundTasks):
    # 1. Fetch job
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    script_data = job.get("metadata", {}).get("script")
    
    if not script_data:
        return {"status": "error", "message": "Script must be generated before audio."}
    
    # 2. Update status to processing (active stage)
    supabase_admin.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()
    
    # 3. Queue Task
    background_tasks.add_task(
        background_audio_task, 
        job_id, 
        script_data["script"], 
        job["user_id"], 
        job.get("metadata", {}).get("config", {}).get("duration_seconds", 0),
        job.get("metadata", {})
    )
    
    return {"status": "success", "message": "Audio generation started in background"}

@app.post("/jobs/{job_id}/reset")
async def reset_job(job_id: str):
    # Fetch current metadata to preserve some info but clear production results
    job_resp = supabase_admin.table("jobs").select("metadata").eq("id", job_id).single().execute()
    metadata = job_resp.data.get("metadata", {}) if job_resp.data else {}
    
    # Reset status and clear production metadata
    # We keep the config/url/extraction but let user re-select duration
    supabase_admin.table("jobs").update({
        "status": "pending_duration",
        "metadata": {
            "url": metadata.get("url"),
            "extraction": metadata.get("extraction"),
            "original_url": metadata.get("original_url")
        }
    }).eq("id", job_id).execute()
    
    return {"status": "success", "message": "Job reset to duration selection."}

async def background_media_plan_task(job_id: str, script_text: str, duration: int, user_id: str, metadata: dict, improve: bool = False):
    try:
        from app.services.media import generate_media_plan
        result = await generate_media_plan(job_id, script_text, duration, user_id, improve=improve)
        
        if result["status"] == "success":
            supabase_admin.table("jobs").update({
                "status": "pending_media",
                "metadata": {
                    **metadata,
                    "media_plan": result
                }
            }).eq("id", job_id).execute()
        else:
            supabase_admin.table("jobs").update({
                "status": "failed",
                "error_message": result.get("message", "Media planning failed")
            }).eq("id", job_id).execute()
    except Exception as e:
        print(f"Background media plan crash: {e}")
        supabase_admin.table("jobs").update({
            "status": "failed",
            "error_message": f"Background media plan error: {str(e)}"
        }).eq("id", job_id).execute()

@app.post("/jobs/{job_id}/generate-media-plan")
async def trigger_media_plan(job_id: str, background_tasks: BackgroundTasks, improve: bool = False):
    # 1. Fetch job
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    script_data = job.get("metadata", {}).get("script")
    config = job.get("metadata", {}).get("config")
    
    if not script_data or not config:
        return {"status": "error", "message": "Script and duration must be set before media planning."}
    
    # 2. Update status to processing
    supabase_admin.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()
    
    # 3. Queue Task
    background_tasks.add_task(
        background_media_plan_task, 
        job_id, 
        script_data["script"], 
        config["duration_seconds"], 
        job["user_id"], 
        job.get("metadata", {}),
        improve=improve
    )
    
    return {"status": "success", "message": "Media planning started in background"}

# YouTube OAuth Configuration
YOUTUBE_CLIENT_ID = os.getenv("YOUTUBE_CLIENT_ID")
YOUTUBE_CLIENT_SECRET = os.getenv("YOUTUBE_CLIENT_SECRET")
YOUTUBE_REDIRECT_URI = os.getenv("YOUTUBE_REDIRECT_URI")

LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI")

SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]

@app.get("/auth/youtube/login")
async def youtube_login(user_id: str):
    # Construct URL manually to avoid PKCE requirement on localhost
    base_url = "https://accounts.google.com/o/oauth2/auth"
    params = {
        "client_id": YOUTUBE_CLIENT_ID,
        "redirect_uri": YOUTUBE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "state": user_id,
        "prompt": "consent"
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return RedirectResponse(f"{base_url}?{query_string}")

@app.get("/auth/youtube/callback")
async def youtube_callback(code: str, state: str):
    user_id = state
    
    # Manual token exchange to avoid PKCE/Verifier issues on localhost
    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": YOUTUBE_CLIENT_ID,
            "client_secret": YOUTUBE_CLIENT_SECRET,
            "redirect_uri": YOUTUBE_REDIRECT_URI,
            "grant_type": "authorization_code"
        })
        
        if token_resp.status_code != 200:
            logger.error(f"Token exchange failed: {token_resp.text}")
            return RedirectResponse(url=f"http://localhost:3000/dashboard/settings?youtube=error&message=token_exchange_failed")
            
        creds_data = token_resp.json()
        
        # Save credentials to user_settings
        supabase_admin.table("user_settings").update({
            "youtube_credentials": {
                "token": creds_data.get("access_token"),
                "refresh_token": creds_data.get("refresh_token"),
                "token_uri": "https://oauth2.googleapis.com/token",
                "client_id": YOUTUBE_CLIENT_ID,
                "client_secret": YOUTUBE_CLIENT_SECRET,
                "scopes": creds_data.get("scope", "").split(" ")
            },
            "youtube_connected": True
        }).eq("user_id", user_id).execute()
    
    # Redirect back to frontend settings
    return RedirectResponse(url=f"http://localhost:3000/dashboard/settings?youtube=success")

# --- LinkedIn OAuth ---

@app.get("/auth/linkedin/login")
async def linkedin_login(user_id: str):
    base_url = "https://www.linkedin.com/oauth/v2/authorization"
    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "state": user_id,
        "scope": "openid profile email w_member_social", # New OIDC scopes
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return RedirectResponse(f"{base_url}?{query_string}")

@app.get("/auth/linkedin/callback")
async def linkedin_callback(code: str, state: str):
    user_id = state
    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://www.linkedin.com/oauth/v2/accessToken", data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": LINKEDIN_REDIRECT_URI,
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET,
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        
        if token_resp.status_code != 200:
            logger.error(f"LinkedIn token exchange failed: {token_resp.text}")
            return RedirectResponse(url=f"http://localhost:3000/dashboard/settings?linkedin=error&message=token_exchange_failed")
            
        token_data = token_resp.json()
        
        # Save credentials to user_settings
        supabase_admin.table("user_settings").update({
            "linkedin_credentials": {
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"), # Optional
                "expires_in": token_data.get("expires_in"),
                "scope": token_data.get("scope")
            },
            "linkedin_connected": True
        }).eq("user_id", user_id).execute()
        
    return RedirectResponse(url=f"http://localhost:3000/dashboard/settings?linkedin=success")

@app.post("/telegram/webhook")
async def telegram_webhook(update: dict):
    """
    Handle incoming Telegram updates (e.g. button clicks).
    """
    if "callback_query" in update:
        query = update["callback_query"]
        callback_data = query.get("data")
        if callback_data:
            # Respond to Telegram to show confirmation and remove buttons
            # We need to find the token for this specific job
            review_status, job_id = await handle_callback(callback_data)
            
            # Answer callback to stop loading spinner
            user_id_resp = supabase_admin.table("jobs").select("user_id").eq("id", job_id).single().execute()
            user_id = user_id_resp.data.get("user_id")
            
            settings_resp = supabase_admin.table("user_settings").select("telegram_bot_token, telegram_chat_id").eq("user_id", user_id).single().execute()
            settings = settings_resp.data or {}
            
            token = settings.get("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
            chat_id = settings.get("telegram_chat_id") or os.getenv("TELEGRAM_CHAT_ID")
            
            if token and chat_id:
                msg = "✅ Production Approved! Marking as complete." if review_status == 'accepted' else "❌ Production Rejected. Job marked as failed."
                async with httpx.AsyncClient() as client:
                    # Answer callback to stop loading spinner
                    await client.post(f"https://api.telegram.org/bot{token}/answerCallbackQuery", json={
                        "callback_query_id": query["id"],
                        "text": msg
                    })
                    # Edit original message to remove buttons and show status
                    await client.post(f"https://api.telegram.org/bot{token}/editMessageCaption", json={
                        "chat_id": chat_id,
                        "message_id": query["message"]["message_id"],
                        "caption": f"{query['message'].get('caption', '')}\n\n*Status: {msg}*",
                        "parse_mode": "Markdown"
                    })
            
            return {"status": "success"}
    return {"status": "ignored"}

async def background_render_task(job_id: str, user_id: str, metadata: dict):
    try:
        result = await render_video(job_id, user_id, metadata)
        
        if result["status"] == "success":
            final_metadata = {
                **metadata,
                "video": result
            }
            supabase_admin.table("jobs").update({
                "status": "completed",
                "metadata": final_metadata
            }).eq("id", job_id).execute()

            # Get settings for bot token
            settings_resp = supabase_admin.table("user_settings").select("telegram_bot_token, telegram_chat_id").eq("user_id", user_id).single().execute()
            settings = settings_resp.data or {}
            token = settings.get("telegram_bot_token")
            chat_id = settings.get("telegram_chat_id")
            
            if token and chat_id:
                duration = metadata.get("duration_seconds", 60)
                video_path = result.get("storage_path")
                if video_path and os.path.exists(video_path):
                    await send_video_for_review(job_id, video_path, duration, token, chat_id)
        else:
            supabase_admin.table("jobs").update({
                "status": "failed",
                "error_message": result.get("message", "Video rendering failed")
            }).eq("id", job_id).execute()
    except Exception as e:
        print(f"Background render crash: {e}")
        supabase_admin.table("jobs").update({
            "status": "failed",
            "error_message": f"Background process error: {str(e)}"
        }).eq("id", job_id).execute()

@app.post("/jobs/{job_id}/render")
async def trigger_render(job_id: str, background_tasks: BackgroundTasks):
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    supabase_admin.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()
    
    background_tasks.add_task(background_render_task, job_id, job["user_id"], job.get("metadata", {}))
    
    return {"status": "success", "message": "Rendering started in background"}

@app.post("/telegram/verify")
async def verify_telegram(request: TelegramVerifyRequest):
    token = request.token
    base_url = f"https://api.telegram.org/bot{token}"
    
    async with httpx.AsyncClient() as client:
        try:
            # 1. Validate Token
            me_resp = await client.get(f"{base_url}/getMe")
            if me_resp.status_code != 200:
                return {"status": "error", "message": "Invalid bot token"}
            
            bot_info = me_resp.json()["result"]
            
            # 2. Get Updates to find Chat ID
            updates_resp = await client.get(f"{base_url}/getUpdates")
            updates = updates_resp.json().get("result", [])
            
            if not updates:
                return {
                    "status": "error", 
                    "message": f"No messages found for @{bot_info['username']}. Please send a message to the bot first!"
                }
            
            # Get the latest chat_id
            latest_update = updates[-1]
            chat_id = latest_update.get("message", {}).get("chat", {}).get("id")
            
            if not chat_id:
                return {"status": "error", "message": "Could not extract Chat ID from latest message"}
            
            # 3. Send confirmation message
            await client.post(f"{base_url}/sendMessage", json={
                "chat_id": chat_id,
                "text": "✅ Connection Verified! Your Articlo account is now linked to this Telegram bot."
            })
            
            return {
                "status": "success",
                "chat_id": str(chat_id),
                "bot_username": bot_info["username"]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}

@app.post("/jobs/{job_id}/thumbnails")
async def get_thumbnails(job_id: str):
    res = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    job = res.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    user_id = job.get("user_id")
    script = job.get("metadata", {}).get("script", {}).get("script", "")
    title = job.get("metadata", {}).get("extraction", {}).get("title", "Breaking News")
    
    result = await generate_thumbnails(job_id, script, title, user_id)
    
    if result["status"] == "success":
        # Store in metadata so they persist
        metadata = job.get("metadata", {})
        metadata["generated_thumbnails"] = result["thumbnails"]
        supabase_admin.table("jobs").update({"metadata": metadata}).eq("id", job_id).execute()
        
    return result

@app.post("/jobs/{job_id}/publish/youtube")
async def publish_to_youtube(job_id: str, request: YouTubePublishRequest):
    res = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    job = res.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    metadata = job.get("metadata", {})
    video_data = metadata.get("video", {})
    storage_path = video_data.get("storage_path")
    
    if not storage_path:
        return {"status": "error", "message": "No video found to publish."}
        
    # Download from Supabase
    local_path = f"temp_publish_{job_id}.mp4"
    try:
        with open(local_path, "wb") as f:
            f.write(supabase_admin.storage.from_("job-assets").download(storage_path))
            
        config = metadata.get("config", {})
        duration = config.get("duration_seconds", 0)
        
        yt_res = await upload_video_to_youtube(
            job_id, 
            local_path, 
            request.title, 
            request.description, 
            duration, 
            job["user_id"],
            privacy_status=request.privacy_status,
            thumbnail_url=request.thumbnail_url
        )
        
        if yt_res["status"] == "success":
            metadata["youtube"] = yt_res
            supabase_admin.table("jobs").update({"metadata": metadata}).eq("id", job_id).execute()
            return {"status": "success", "url": yt_res["url"]}
        else:
            return yt_res
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)

@app.post("/jobs/{job_id}/publish/linkedin")
async def publish_to_linkedin(job_id: str, request: LinkedInPublishRequest):
    res = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    job = res.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    metadata = job.get("metadata", {})
    video_data = metadata.get("video", {})
    storage_path = video_data.get("storage_path")
    
    if not storage_path:
        return {"status": "error", "message": "No video found to publish."}
        
    # Download from Supabase
    local_path = f"temp_publish_li_{job_id}.mp4"
    try:
        with open(local_path, "wb") as f:
            f.write(supabase_admin.storage.from_("job-assets").download(storage_path))
            
        li_res = await upload_video_to_linkedin(
            job_id, 
            local_path, 
            request.title, 
            request.description, 
            job["user_id"],
            visibility=request.visibility
        )
        
        if li_res["status"] == "success":
            metadata["linkedin"] = li_res
            supabase_admin.table("jobs").update({"metadata": metadata}).eq("id", job_id).execute()
            return {"status": "success", "url": li_res["url"]}
        else:
            return li_res
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)

@app.post("/jobs/{job_id}/generate-linkedin-description")
async def ai_generate_linkedin_description(job_id: str, request: LinkedInDescriptionRequest):
    res = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    job = res.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    script = job.get("metadata", {}).get("script", {}).get("script")
    if not script:
        return {"status": "error", "message": "No script found for this job to generate from."}
        
    # Build social footer
    social_footer = await get_social_footer(job["user_id"], enabled_platforms=request.enabled_platforms)
    
    gen_res = generate_linkedin_description(script, theme=request.theme, social_footer=social_footer)
    return gen_res

@app.post("/jobs/{job_id}/generate-youtube-description")
async def ai_generate_youtube_description(job_id: str, request: LinkedInDescriptionRequest):
    # We can reuse the LinkedIn prompt logic for now as it's a good summary + hashtags
    res = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    job = res.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    script = job.get("metadata", {}).get("script", {}).get("script")
    if not script:
        return {"status": "error", "message": "No script found for this job to generate from."}
        
    social_footer = await get_social_footer(job["user_id"], enabled_platforms=request.enabled_platforms)
    
    # Use a slightly different prompt for YouTube if needed, but the LinkedIn one is actually quite good
    gen_res = generate_linkedin_description(script, theme=request.theme or "informative", social_footer=social_footer)
    return gen_res

@app.post("/jobs/{job_id}/send-telegram")
async def send_to_telegram_route(job_id: str, request: TelegramSendRequest):
    res = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    job = res.data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    metadata = job.get("metadata", {})
    video_data = metadata.get("video", {})
    storage_path = video_data.get("storage_path")
    
    if not storage_path:
        return {"status": "error", "message": "No video found to send."}
        
    # Download from Supabase
    local_path = f"temp_send_tg_{job_id}.mp4"
    try:
        with open(local_path, "wb") as f:
            f.write(supabase_admin.storage.from_("job-assets").download(storage_path))
            
        # Get settings for bot token
        settings_resp = supabase_admin.table("user_settings").select("telegram_bot_token, telegram_chat_id").eq("user_id", job["user_id"]).single().execute()
        settings = settings_resp.data or {}
        
        success = await send_video_to_telegram(
            job_id, 
            local_path, 
            request.caption, 
            bot_token=settings.get("telegram_bot_token"), 
            chat_id=settings.get("telegram_chat_id")
        )
        
        if success:
            return {"status": "success", "message": "Sent to Telegram successfully!"}
        else:
            return {"status": "error", "message": "Failed to send to Telegram."}
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)

@app.post("/jobs/{job_id}/approve")
async def approve_job(job_id: str, background_tasks: BackgroundTasks):
    # 1. Fetch job
    job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_resp.data:
        return {"status": "error", "message": "Job not found"}
    
    job = job_resp.data
    video_data = job.get("metadata", {}).get("video")
    
    if not video_data:
        return {"status": "error", "message": "No video found to approve."}
    
    # 2. Update status/metadata immediately
    metadata = job.get("metadata", {})
    metadata["review_status"] = "accepted"
    supabase_admin.table("jobs").update({
        "metadata": metadata
    }).eq("id", job_id).execute()
    
    # 3. Queue Telegram send in background
    background_tasks.add_task(background_approve_task, job_id, job["user_id"], metadata, video_data)
    
    return {"status": "success", "message": "Job approved. Sending to Telegram in background..."}

async def background_approve_task(job_id: str, user_id: str, metadata: dict, video_data: dict):
    try:
        # Get settings
        settings_resp = supabase_admin.table("user_settings").select("telegram_bot_token, telegram_chat_id").eq("user_id", user_id).single().execute()
        settings = settings_resp.data or {}
        bot_token = settings.get("telegram_bot_token")
        chat_id = settings.get("telegram_chat_id")

        config = metadata.get("config", {})
        duration = config.get("duration_seconds", 0)
        video_local_path = video_data.get("local_path")
        
        # Check if we need to download from Supabase fallback
        if not video_local_path or not os.path.exists(video_local_path):
            storage_path = video_data.get("storage_path")
            if storage_path:
                video_local_path = f"temp_{job_id}.mp4"
                with open(video_local_path, "wb") as f:
                    f.write(supabase_admin.storage.from_("job-assets").download(storage_path))
        
        if video_local_path and os.path.exists(video_local_path):
            await send_video_for_review(job_id, video_local_path, duration, bot_token=bot_token, chat_id=chat_id)
            
    except Exception as e:
        logger.error(f"Background approve task failed: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
