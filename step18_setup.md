# Step 18: Instagram Reels Publishing Setup

This guide covers the Meta API setup and configuration required for the automated Instagram Reels publishing workflow.

## 1. Meta API Setup Steps

To publish Reels via API, you need a **Facebook App** with the **Instagram Graph API** and **Instagram Content Publishing API** permissions.

### A. Facebook App Creation
1. Go to [Meta for Developers](https://developers.facebook.com/) and create a new App (Type: **Business**).
2. Add **Instagram Graph API** to your app.

### B. Account Requirements
1. **Instagram Business Account**: Your Instagram account must be a **Business Account** (not Personal or Creator).
2. **Linked Facebook Page**: The Instagram Business Account must be linked to a Facebook Page that you manage.

### C. Permissions
You need to generate a **User Access Token** (Long-Lived) with the following permissions:
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`
- `ads_management` (sometimes required for certain Reels features)

### D. Generate Credentials
1. Use the [Graph API Explorer](https://developers.facebook.com/tools/explorer/) to get a short-lived token.
2. Exchange it for a **Long-Lived Access Token** (valid for 60 days).
3. Find your **Instagram Business Account ID**:
   - Query: `GET /v19.0/me/accounts?fields=instagram_business_account`
   - This will return the ID needed for `INSTAGRAM_BUSINESS_ACCOUNT_ID`.

---

## 2. Environment Variables

Add these to your `backend/.env` (and ensure the worker can access them):

```env
# Instagram Meta API (Optional if stored in user_settings per-user)
# For a single-user system, you can set these here:
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_business_id
```

> [!NOTE]
> The current implementation fetches these from the `user_settings` table in Supabase, allowing different users to have their own Instagram accounts connected.

---

## 3. Database Schema Update

Ensure you have run the following SQL in your Supabase SQL Editor:

```sql
-- Add Instagram Meta API credentials to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT;

-- Update job status to include instagram states
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'telegram_approved', 'instagram_uploading', 'instagram_failed'));
```

---

## 4. Test Steps

1. **Prerequisite**: Ensure you have a job with a valid video URL in Supabase.
2. **Manual Approval**: Manually update a job's status to `telegram_approved` in the Supabase dashboard.
3. **Start Worker**:
   ```bash
   cd worker
   python main.py
   ```
4. **Monitor Logs**: The worker should detect the job, transition status to `instagram_uploading`, and attempt the 3-step Meta API process.
5. **Verify**:
   - Success: Job status becomes `completed`.
   - Failure: Job status becomes `instagram_failed` with the exact error message.
