-- Step 20: Add LinkedIn credentials to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS linkedin_credentials JSONB DEFAULT '{}'::jsonb;

-- Update job status to include LinkedIn states
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'pending_extraction',
  'extracting',
  'pending_duration',
  'pending_script',
  'scripting',
  'pending_media',
  'processing',
  'completed',
  'failed',
  'telegram_approved',
  'instagram_uploading',
  'instagram_failed',
  'linkedin_uploading',
  'linkedin_failed'
));
