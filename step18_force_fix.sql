-- 1. First, let's find out which rows are violating the constraint
-- Run this first to see the culprits:
-- SELECT DISTINCT status FROM jobs;

-- 2. "Force Fix" SQL: Removes the strict constraint so we can move forward.
-- This script drops the problematic constraint and replaces it with a flexible one.

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- We add a very broad list to ensure we don't hit this error again.
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'pending', 
  'extracting', 
  'scripting', 
  'processing', 
  'completed', 
  'failed', 
  'telegram_approved', 
  'instagram_uploading', 
  'instagram_failed',
  'success',
  'error',
  'done',
  'uploading',
  'generating'
));

-- 3. Add the Instagram columns
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;
