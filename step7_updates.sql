-- Step 7: Update job status constraints

-- 1. Drop existing constraint
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- 2. Add new constraint with all required statuses
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'pending_extraction', 
  'extracting', 
  'pending_script', 
  'scripting', 
  'pending_media', 
  'processing', 
  'completed', 
  'failed'
));

-- 3. Update default status for new jobs
ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT 'pending_extraction';
