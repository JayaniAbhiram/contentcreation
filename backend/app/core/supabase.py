import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# For backend, we use the Service Role Key for admin access
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("WARNING: Supabase URL or Service Role Key not found in environment.")

supabase: Client = create_client(url, key)
