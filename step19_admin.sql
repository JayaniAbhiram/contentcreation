-- Step 19: Admin Roles and Monitoring
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Optional: Set the first user as admin (replace with your user ID)
-- UPDATE profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';

-- Create a view for storage stats (approximate)
CREATE OR REPLACE VIEW admin_storage_stats AS
SELECT 
    asset_type,
    count(*) as total_files,
    sum(pg_column_size(storage_path)) as estimated_metadata_size
FROM job_outputs
GROUP BY asset_type;
