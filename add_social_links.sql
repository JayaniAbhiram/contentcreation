-- Add social media link columns to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS telegram_channel_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_page_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_page_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_channel_url TEXT;
