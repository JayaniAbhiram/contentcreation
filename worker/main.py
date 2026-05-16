import time
import os
import sys
import logging
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

# Add backend to path to import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.services.instagram_service import publish_to_instagram

# Load environment variables from worker or backend directory
load_dotenv()
if not os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("InstagramWorker")

# Supabase Admin Client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

async def process_instagram_uploads():
    """
    Polls for jobs with status 'telegram_approved' and attempts to publish to Instagram.
    """
    logger.info("Instagram Worker Polling Started...")
    
    while True:
        try:
            # 1. Fetch jobs that are approved but not yet uploaded to Instagram
            res = supabase.table("jobs").select("*").eq("status", "telegram_approved").execute()
            jobs = res.data or []
            
            for job in jobs:
                job_id = job["id"]
                user_id = job["user_id"]
                
                logger.info(f"Processing Instagram upload for Job: {job_id}")
                
                # Update status to 'instagram_uploading'
                supabase.table("jobs").update({"status": "instagram_uploading"}).eq("id", job_id).execute()
                
                # 2. Get User Settings for Instagram Credentials
                settings_res = supabase.table("user_settings").select("*").eq("user_id", user_id).single().execute()
                settings = settings_res.data
                
                access_token = settings.get("instagram_access_token")
                ig_user_id = settings.get("instagram_business_account_id")
                
                if not access_token or not ig_user_id:
                    logger.error(f"Missing Instagram credentials for user {user_id}")
                    supabase.table("jobs").update({
                        "status": "instagram_failed",
                        "error_message": "Instagram upload failed: Missing credentials"
                    }).eq("id", job_id).execute()
                    continue

                # 3. Get Video URL from metadata
                # Assuming metadata structure from previous steps
                video_url = job.get("metadata", {}).get("video", {}).get("public_url")
                if not video_url:
                    # Fallback to job_outputs
                    outputs_res = supabase.table("job_outputs").select("public_url").eq("job_id", job_id).eq("asset_type", "video").order("created_at", desc=True).limit(1).execute()
                    if outputs_res.data:
                        video_url = outputs_res.data[0]["public_url"]

                if not video_url:
                    logger.error(f"No video URL found for job {job_id}")
                    supabase.table("jobs").update({
                        "status": "instagram_failed",
                        "error_message": "Instagram upload failed: Video URL not found"
                    }).eq("id", job_id).execute()
                    continue

                caption = job.get("metadata", {}).get("script", {}).get("youtube_meta", {}).get("title", "Check out this AI-generated news!")
                
                # 4. Attempt Publish
                logger.info(f"Uploading Reel to Instagram: {video_url}")
                result = await publish_to_instagram(video_url, caption, access_token, ig_user_id)
                
                if result["status"] == "success":
                    logger.info(f"Instagram Publication Successful for job {job_id}")
                    supabase.table("jobs").update({
                        "status": "completed",
                        "metadata": {**job.get("metadata", {}), "instagram_id": result["reel_id"]}
                    }).eq("id", job_id).execute()
                else:
                    logger.error(f"Instagram Publication Failed: {result['message']}")
                    supabase.table("jobs").update({
                        "status": "instagram_failed",
                        "error_message": f"Instagram upload failed: {result['message']}"
                    }).eq("id", job_id).execute()

        except Exception as e:
            logger.error(f"Worker Error: {e}")
        
        # Poll every 30 seconds
        await asyncio.sleep(30)

if __name__ == "__main__":
    asyncio.run(process_instagram_uploads())
