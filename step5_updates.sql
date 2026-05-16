-- Step 5: Add media path columns to user_settings

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS selfie_path TEXT,
ADD COLUMN IF NOT EXISTS voice_sample_path TEXT,
ADD COLUMN IF NOT EXISTS demo_video_path TEXT;
