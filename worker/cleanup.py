import os
import logging
import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("CleanupWorker")

# Supabase Admin Client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

def run_cleanup():
    """
    Deletes generated media (job_outputs and storage files) older than 30 days.
    """
    logger.info("Starting 30-day cleanup job...")
    
    # 1. Calculate cutoff date
    cutoff = (datetime.datetime.now() - datetime.timedelta(days=30)).isoformat()
    
    try:
        # 2. Fetch old outputs
        res = supabase.table("job_outputs").select("*").lt("created_at", cutoff).execute()
        old_outputs = res.data or []
        
        if not old_outputs:
            logger.info("No old media found for cleanup.")
            return

        logger.info(f"Found {len(old_outputs)} files to delete.")
        
        for output in old_outputs:
            path = output["storage_path"]
            asset_type = output["asset_type"]
            
            # 3. Determine bucket (assuming mapping or checking both)
            buckets = ["generated-videos", "job-assets", "generated-previews"]
            
            for bucket in buckets:
                try:
                    # Attempt to delete from storage
                    supabase.storage.from_(bucket).remove([path])
                except:
                    continue
            
            # 4. Delete DB record
            supabase.table("job_outputs").delete().eq("id", output["id"]).execute()
            logger.info(f"Deleted {asset_type}: {path}")

        logger.info("Cleanup completed successfully.")

    except Exception as e:
        logger.error(f"Cleanup Error: {e}")

if __name__ == "__main__":
    run_cleanup()
