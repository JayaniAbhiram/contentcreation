-- Step 17: Add YouTube credentials to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS youtube_credentials JSONB DEFAULT '{}'::jsonb;
