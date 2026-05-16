-- Step 4: Add configuration fields to user_settings

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS intro_text TEXT DEFAULT 'Hello, welcome to my video!',
ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
ADD COLUMN IF NOT EXISTS anime_style_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS youtube_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS instagram_connected BOOLEAN DEFAULT FALSE;

-- Ensure RLS is still correct (should be covered by existing policies)
-- But just in case, verify users can only update their own settings:
-- Policy "Users can update own settings" already exists in schema.sql
