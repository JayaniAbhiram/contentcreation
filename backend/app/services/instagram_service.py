import os
import logging
import time
import httpx
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

class InstagramService:
    def __init__(self, access_token: str, ig_user_id: str):
        self.access_token = access_token
        self.ig_user_id = ig_user_id
        self.base_url = "https://graph.facebook.com/v19.0"

    async def publish_reel(self, video_url: str, caption: str) -> dict:
        """
        Publishes a video to Instagram Reels.
        Flow: Create Container -> Poll for Status -> Publish Container
        """
        try:
            # 1. Create Media Container
            container_url = f"{self.base_url}/{self.ig_user_id}/media"
            params = {
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption,
                "access_token": self.access_token
            }
            
            async with httpx.AsyncClient() as client:
                resp = await client.post(container_url, params=params)
                data = resp.json()
                
                if "id" not in data:
                    logger.error(f"Failed to create Instagram container: {data}")
                    return {"status": "error", "message": f"Instagram container creation failed: {data.get('error', {}).get('message', 'Unknown error')}"}
                
                container_id = data["id"]
                logger.info(f"Instagram container created: {container_id}")

                # 2. Poll for Status (Attempt for 2 minutes as requested)
                # We'll check every 10 seconds
                start_time = time.time()
                timeout = 120 # 2 minutes
                
                while time.time() - start_time < timeout:
                    status_url = f"{self.base_url}/{container_id}"
                    status_params = {
                        "fields": "status_code",
                        "access_token": self.access_token
                    }
                    status_resp = await client.get(status_url, params=status_params)
                    status_data = status_resp.json()
                    
                    status_code = status_data.get("status_code")
                    if status_code == "FINISHED":
                        logger.info("Instagram container processing finished.")
                        break
                    elif status_code == "ERROR":
                        logger.error(f"Instagram processing error: {status_data}")
                        return {"status": "error", "message": "Instagram processing failed."}
                    
                    logger.info(f"Instagram processing status: {status_code}. Waiting...")
                    await asyncio.sleep(10)
                else:
                    return {"status": "error", "message": "Instagram upload failed (Timeout)"}

                # 3. Publish the Container
                publish_url = f"{self.base_url}/{self.ig_user_id}/media_publish"
                publish_params = {
                    "creation_id": container_id,
                    "access_token": self.access_token
                }
                publish_resp = await client.post(publish_url, params=publish_params)
                publish_data = publish_resp.json()
                
                if "id" in publish_data:
                    logger.info(f"Successfully published Reel: {publish_data['id']}")
                    return {"status": "success", "reel_id": publish_data["id"]}
                else:
                    logger.error(f"Failed to publish Instagram Reel: {publish_data}")
                    return {"status": "error", "message": f"Instagram publish failed: {publish_data.get('error', {}).get('message', 'Unknown error')}"}

        except Exception as e:
            logger.error(f"Instagram Service Error: {e}")
            return {"status": "error", "message": f"Instagram Service Exception: {str(e)}"}

async def publish_to_instagram(video_url: str, caption: str, access_token: str, ig_user_id: str):
    service = InstagramService(access_token, ig_user_id)
    return await service.publish_reel(video_url, caption)
