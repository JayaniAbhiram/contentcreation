-- Step 9: Add pending_duration status

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'pending_extraction', 
  'extracting', 
  'pending_duration',
  'pending_script', 
  'scripting', 
  'pending_media', 
  'processing', 
  'completed', 
  'failed'
));
