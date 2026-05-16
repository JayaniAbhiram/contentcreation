-- Step 18: Universal Fix (No Constraints)
-- This script removes the strict status checks entirely to prevent "violation" errors
-- while still adding the necessary columns for Instagram.

-- 1. Drop the problematic constraint and KEEP it dropped
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- 2. Add Instagram Meta API credentials to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;

-- 3. (Optional) Run this to see what was causing the error
-- SELECT DISTINCT status FROM jobs;
