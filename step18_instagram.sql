-- Step 18: Add Instagram Meta API credentials to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;

-- Update job status to include ALL required states from previous steps + new Instagram states
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'pending_extraction',
  'extracting',
  'pending_script',
  'scripting',
  'pending_media',
  'processing',
  'completed',
  'failed',
  'telegram_approved',
  'instagram_uploading',
  'instagram_failed'
));
