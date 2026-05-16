# 🚀 Live Deployment Guide: Articlo AI

This guide covers how to deploy the Articlo project live using **Vercel** (Frontend), **Render** (Backend), and **Supabase** (Database/Auth).

---

## 1. Supabase (Database & Auth)
*No changes needed if you are already using a live Supabase project.*
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication > URL Configuration**.
3. Set **Site URL** to your Vercel URL (e.g., `https://articlo.vercel.app`).
4. Add `http://localhost:3000/**` to **Redirect URLs**.

---

## 2. Backend (FastAPI) on Render
1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your GitHub Repository.
3. Set **Root Directory** to `backend`.
4. **Environment**: Python 3.
5. **Build Command**: `pip install -r requirements.txt`.
6. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
7. **Environment Variables**:
   - Copy all variables from `.env.production.example`.
   - Ensure `META_REDIRECT_URI` and `YOUTUBE_REDIRECT_URI` use your Render URL.

---

## 3. Worker (FFmpeg Rendering) on Render
*The worker needs a persistent environment with FFmpeg.*
1. Create a **Background Worker** on Render.
2. Set **Root Directory** to `worker`.
3. **Build Command**: 
   ```bash
   apt-get update && apt-get install -y ffmpeg && pip install -r requirements.txt
   ```
4. **Start Command**: `python main.py`.
5. **Environment Variables**:
   - Same as Backend.

---

## 4. Frontend (Next.js) on Vercel
1. Import your repository to [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend`.
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
   - `NEXT_PUBLIC_BACKEND_URL`: Your **Render API URL** (e.g., `https://articlo-api.onrender.com`).
4. Click **Deploy**.

---

## 5. Final OAuth Configuration
1. **Google Cloud Console**:
   - Update your **Authorized Redirect URIs** to:
     `https://articlo-api.onrender.com/auth/youtube/callback`
2. **Meta Developer Dashboard**:
   - Update your **Valid OAuth Redirect URIs** to:
     `https://articlo-api.onrender.com/auth/instagram/callback`

---

## 📊 Post-Deployment Checklist
- [ ] Sign in with your production URL.
- [ ] Generate a test video.
- [ ] Check if the video is delivered to Telegram.
- [ ] Test the "Publish to YouTube" flow with a live channel.
