-- Step 18: Final Comprehensive SQL Fix
-- This includes every single status defined in the history of this project.

-- 1. Add Instagram Meta API credentials to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;

-- 2. Update job status with the absolute full list of all historical states
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'pending',
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
  'instagram_failed'
));
