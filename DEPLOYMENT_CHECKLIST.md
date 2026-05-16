# 🚀 Deployment & Launch Guide: Articlo AI

To run this project properly without errors in a production environment, follow these steps in order.

## 1. Database Setup (Supabase)
Ensure your live database is ready to handle all pipeline statuses.

1.  **Run SQL Migrations**: Open your Supabase SQL Editor and run the following files in order:
    *   `update_status_constraint.sql` — *Critical for the rendering pipeline.*
    *   `step20_linkedin.sql` — *Required for social features.*
2.  **Enable Realtime**: Ensure the `jobs` table has **Realtime** enabled so the UI updates automatically.

---

## 2. Backend API (FastAPI)
Host this on a service like **Render** or **Railway**.

*   **Root Directory**: `backend`
*   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
*   **Environment Variables**:
    *   `SUPABASE_URL`: Your project URL.
    *   `SUPABASE_SERVICE_KEY`: Use the **service_role** key (not anon).
    *   `OPENAI_API_KEY`: Your key.
    *   `ELEVENLABS_API_KEY`: Your key.
    *   `PEXELS_API_KEY`: Your key.
    *   `TELEGRAM_BOT_TOKEN`: Default bot token.

---

## 3. Worker Service (The Engine)
The worker handles heavy FFmpeg rendering. **IMPORTANT**: This service must have FFmpeg installed.

*   **Host**: Render (Background Worker) or a VPS.
*   **Root Directory**: `worker`
*   **Install Commands**:
    ```bash
    apt-get update && apt-get install -y ffmpeg
    pip install -r requirements.txt
    ```
*   **Start Command**: `python main.py`

---

## 4. Frontend (Next.js)
Host on **Vercel**.

*   **Root Directory**: `frontend`
*   **Environment Variables**:
    *   `NEXT_PUBLIC_SUPABASE_URL`: Same as backend.
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Use the **anon** key.
    *   `NEXT_PUBLIC_BACKEND_URL`: The URL of your **Backend API** (Step 2).

---

## 🛠️ Verification Checklist (After Launch)
1.  **Login**: Ensure you can sign in with your email/google.
2.  **Settings**: Upload your selfie and voice sample in the new **Settings Tabs**.
3.  **Pipeline**: Run a test job. The pipeline should move from **Scripting** → **Media** → **Rendering** without getting stuck at 100%.
4.  **Telegram**: Verify the video arrives in your Telegram chat for approval.
5.  **Social**: Test the **Publish to YouTube** button on the social page and verify the live link appears.

## 🆘 Troubleshooting Common Errors
*   **"Failed to fetch"**: Usually means the `NEXT_PUBLIC_BACKEND_URL` is wrong or the backend is sleeping.
*   **"Timed out"**: Telegram videos are large. Ensure the worker has a fast internet connection and the timeout fixes I applied are active.
*   **"Published link not showing"**: Refresh the social page; it will appear as soon as the backend confirms the YouTube ID.
