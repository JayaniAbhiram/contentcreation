import os
import logging
import datetime
import requests
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from app.core.supabase import supabase

logger = logging.getLogger(__name__)

async def get_youtube_service(user_id: str):
    """
    Returns an authorized YouTube service object for the user.
    """
    res = supabase.table("user_settings").select("youtube_credentials").eq("user_id", user_id).single().execute()
    creds_data = res.data.get("youtube_credentials") if res.data else None
    
    if not creds_data:
        logger.error(f"YouTube credentials not found for user {user_id}")
        return None

    creds = Credentials.from_authorized_user_info(creds_data)
    
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Update credentials in DB
        supabase.table("user_settings").update({
            "youtube_credentials": {
                "token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "scopes": creds.scopes
            }
        }).eq("user_id", user_id).execute()

    return build("youtube", "v3", credentials=creds)

async def upload_video_to_youtube(job_id: str, video_path: str, title: str, description: str, duration: int, user_id: str, privacy_status: str = "unlisted", thumbnail_url: str = None):
    """
    Uploads a video to YouTube. Categorizes as Short if duration <= 60s.
    """
    youtube = await get_youtube_service(user_id)
    if not youtube:
        return {"status": "error", "message": "YouTube not connected or authorized."}

    # Add #Shorts tag for short videos to ensure categorization
    final_title = title
    if duration <= 60:
        if "#Shorts" not in title:
            final_title = f"{title} #Shorts"
    
    body = {
        'snippet': {
            'title': final_title[:100], # YouTube limit
            'description': description[:5000],
            'tags': ['AI', 'Generated', 'News'],
            'categoryId': '22' # People & Blogs
        },
        'status': {
            'privacyStatus': privacy_status, # Manual control
            'selfDeclaredMadeForKids': False
        }
    }

    try:
        # Upload video
        media = MediaFileUpload(video_path, chunksize=-1, resumable=True, mimetype='video/mp4')
        
        request = youtube.videos().insert(
            part=','.join(body.keys()),
            body=body,
            media_body=media
        )
        
        logger.info(f"Starting YouTube upload for job {job_id}...")
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                logger.info(f"Uploaded {int(status.progress() * 100)}%")

        video_id = response['id']
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        # Set Thumbnail if provided
        if thumbnail_url:
            try:
                # Download thumbnail temporarily
                temp_thumb = f"temp_thumb_{job_id}.png"
                resp = requests.get(thumbnail_url)
                with open(temp_thumb, "wb") as f:
                    f.write(resp.content)
                
                youtube.thumbnails().set(
                    videoId=video_id,
                    media_body=MediaFileUpload(temp_thumb)
                ).execute()
                
                if os.path.exists(temp_thumb):
                    os.remove(temp_thumb)
            except Exception as e:
                logger.error(f"Failed to set thumbnail: {e}")

        return {
            "status": "success",
            "video_id": video_id,
            "url": video_url
        }

    except Exception as e:
        logger.error(f"YouTube upload failed: {e}")
        return {"status": "error", "message": str(e)}
