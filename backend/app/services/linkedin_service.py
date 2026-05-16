import os
import logging
import httpx
import json
from typing import Optional, Dict, Any
from app.core.supabase import supabase

logger = logging.getLogger(__name__)

LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI")

async def get_linkedin_creds(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches LinkedIn credentials from user_settings.
    """
    res = supabase.table("user_settings").select("linkedin_credentials").eq("user_id", user_id).single().execute()
    return res.data.get("linkedin_credentials") if res.data else None

async def refresh_linkedin_token(user_id: str, refresh_token: str) -> Optional[str]:
    """
    Refreshes the LinkedIn access token.
    LinkedIn tokens last 60 days, and refresh tokens are only available for certain apps.
    If no refresh token, the user must re-authenticate.
    """
    if not refresh_token:
        return None

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://www.linkedin.com/oauth/v2/accessToken", data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET
        })
        
        if resp.status_code == 200:
            data = resp.json()
            new_token = data.get("access_token")
            new_refresh = data.get("refresh_token", refresh_token)
            
            # Update DB
            creds = await get_linkedin_creds(user_id)
            if creds:
                creds["access_token"] = new_token
                creds["refresh_token"] = new_refresh
                supabase.table("user_settings").update({
                    "linkedin_credentials": creds
                }).eq("user_id", user_id).execute()
            
            return new_token
    return None

async def get_linkedin_person_urn(access_token: str) -> Optional[str]:
    """
    Gets the authenticated user's URN.
    """
    async with httpx.AsyncClient() as client:
        # Use OpenID Connect userinfo for newer apps
        resp = await client.get("https://api.linkedin.com/v2/userinfo", headers={
            "Authorization": f"Bearer {access_token}"
        })
        if resp.status_code == 200:
            data = resp.json()
            sub = data.get("sub")
            if sub:
                return f"urn:li:person:{sub}"
        
        # Fallback to older /me endpoint
        resp = await client.get("https://api.linkedin.com/v2/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        if resp.status_code == 200:
            return f"urn:li:person:{resp.json().get('id')}"
            
    return None

async def upload_video_to_linkedin(
    job_id: str, 
    video_path: str, 
    title: str, 
    description: str, 
    user_id: str,
    visibility: str = "PUBLIC"
) -> Dict[str, Any]:
    """
    Uploads a video to LinkedIn in 3 steps: Register, Upload, Post.
    """
    creds = await get_linkedin_creds(user_id)
    if not creds or not creds.get("access_token"):
        return {"status": "error", "message": "LinkedIn not connected."}

    access_token = creds["access_token"]
    person_urn = await get_linkedin_person_urn(access_token)
    
    if not person_urn:
        return {"status": "error", "message": "Could not retrieve LinkedIn profile info."}

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1: Register Upload
        register_payload = {
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-video"],
                "owner": person_urn,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent"
                    }
                ]
            }
        }
        
        reg_resp = await client.post(
            "https://api.linkedin.com/v2/assets?action=registerUpload",
            json=register_payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if reg_resp.status_code != 200:
            logger.error(f"LinkedIn registration failed: {reg_resp.text}")
            return {"status": "error", "message": f"LinkedIn Registration Failed: {reg_resp.text}"}
            
        reg_data = reg_resp.json()
        upload_url = reg_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
        asset_urn = reg_data["value"]["asset"]

        # Step 2: Upload Binary
        logger.info(f"Uploading video to LinkedIn: {video_path}")
        with open(video_path, "rb") as f:
            video_data = f.read()
            up_resp = await client.put(
                upload_url,
                content=video_data,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/octet-stream"
                }
            )
            
        if up_resp.status_code not in [200, 201]:
            logger.error(f"LinkedIn binary upload failed: {up_resp.text}")
            return {"status": "error", "message": "Binary upload failed."}

        # Step 3: Create UGC Post
        post_payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": f"{title}\n\n{description}"
                    },
                    "shareMediaCategory": "VIDEO",
                    "media": [
                        {
                            "status": "READY",
                            "description": {
                                "text": description[:200] # LinkedIn limit for description in media
                            },
                            "media": asset_urn,
                            "title": {
                                "text": title[:200]
                            }
                        }
                    ]
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": visibility
            }
        }
        
        post_resp = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            json=post_payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if post_resp.status_code not in [200, 201]:
            logger.error(f"LinkedIn post creation failed: {post_resp.text}")
            return {"status": "error", "message": f"Post creation failed: {post_resp.text}"}
            
        post_data = post_resp.json()
        return {
            "status": "success",
            "urn": post_data.get("id"),
            "asset_urn": asset_urn,
            "url": f"https://www.linkedin.com/feed/update/{post_data.get('id')}"
        }
