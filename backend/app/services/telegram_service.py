import os
import logging
import httpx
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from pathlib import Path

logger = logging.getLogger(__name__)

# Load from env
# Load from env (Optional Fallback)
DEFAULT_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
DEFAULT_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

async def send_video_for_review(job_id: str, video_path: str, duration: int, bot_token: str = None, chat_id: str = None):
    """
    Sends the generated video to Telegram for user review.
    """
    token = bot_token or DEFAULT_BOT_TOKEN
    chat = chat_id or DEFAULT_CHAT_ID

    if not token or not chat or "YOUR_BOT_TOKEN" in token:
        logger.warning(f"Telegram credentials missing for job {job_id}. Skipping review send.")
        return False

    bot = Bot(token=token)
    
    caption = f"🎬 *New Video Ready for Review*\n\n"
    caption += f"Job ID: `{job_id}`\n"
    caption += f"Duration: {duration}s\n\n"
    caption += "Please approve or reject the production below:"

    keyboard = [
        [
            InlineKeyboardButton("✅ Accept", callback_data=f"accept_{job_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{job_id}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    try:
        # If video is > 50MB, Telegram might reject as a standard video message
        # But for 30s-2m it should be fine. For 8m we send as document.
        file_size = os.path.getsize(video_path) / (1024 * 1024)
        
        with open(video_path, 'rb') as video:
            if duration > 300 or file_size > 45:
                # Send as document for large files (uncompressed)
                logger.info(f"Sending large video ({file_size:.2f}MB) as document.")
                await bot.send_document(
                    chat_id=chat,
                    document=video,
                    caption=caption,
                    parse_mode='Markdown',
                    reply_markup=reply_markup,
                    read_timeout=120,
                    write_timeout=120
                )
            else:
                # Send as standard video
                await bot.send_video(
                    chat_id=chat,
                    video=video,
                    caption=caption,
                    parse_mode='Markdown',
                    reply_markup=reply_markup,
                    supports_streaming=True,
                    read_timeout=120,
                    write_timeout=120
                )
        
        logger.info(f"Video sent to Telegram for job {job_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send video to Telegram: {e}")
        return False

async def handle_callback(callback_data: str):
    """
    Handles the Accept/Reject button clicks.
    Format: 'accept_{job_id}' or 'reject_{job_id}'
    """
    action, job_id = callback_data.split('_')
    
    # We will update the database status here
    from app.core.supabase import supabase
    
    # Get settings to get the bot token for responding
    user_id_resp = supabase.from_('jobs').select('user_id').eq('id', job_id).single().execute()
    user_id = user_id_resp.data.get('user_id')
    
    settings_resp = supabase.from_('user_settings').select('telegram_bot_token, telegram_chat_id').eq('user_id', user_id).single().execute()
    settings = settings_resp.data or {}
    
    token = settings.get('telegram_bot_token') or os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = settings.get('telegram_chat_id') or os.getenv("TELEGRAM_CHAT_ID")

    review_status = 'accepted' if action == 'accept' else 'rejected'
    
    try:
        # Get existing metadata
        res = supabase.from_('jobs').select('metadata').eq('id', job_id).single().execute()
        metadata = res.data.get('metadata', {})
        
        metadata['review_status'] = review_status
        
        # Update job
        supabase.from_('jobs').update({
            'metadata': metadata,
            'status': 'telegram_approved' if review_status == 'accepted' else 'failed',
            'error_message': 'Rejected by user via Telegram' if review_status == 'rejected' else None
        }).eq('id', job_id).execute()
        
        return review_status, job_id
    except Exception as e:
        logger.error(f"Error handling Telegram callback: {e}")
        return None, job_id

async def send_video_to_telegram(job_id: str, video_path: str, caption: str, bot_token: str = None, chat_id: str = None):
    """
    Sends a video and caption to Telegram without review buttons.
    Used for final delivery or sharing.
    """
    token = bot_token or DEFAULT_BOT_TOKEN
    chat = chat_id or DEFAULT_CHAT_ID

    if not token or not chat or "YOUR_BOT_TOKEN" in token:
        logger.warning(f"Telegram credentials missing for job {job_id}. Skipping send.")
        return False

    bot = Bot(token=token)
    
    try:
        file_size = os.path.getsize(video_path) / (1024 * 1024)
        
        with open(video_path, 'rb') as video:
            if file_size > 45:
                await bot.send_document(
                    chat_id=chat,
                    document=video,
                    caption=caption[:1024], # Telegram caption limit
                    parse_mode='Markdown',
                    read_timeout=120,
                    write_timeout=120
                )
            else:
                await bot.send_video(
                    chat_id=chat,
                    video=video,
                    caption=caption[:1024],
                    parse_mode='Markdown',
                    supports_streaming=True,
                    read_timeout=120,
                    write_timeout=120
                )
        return True
    except Exception as e:
        logger.error(f"Failed to send video to Telegram: {e}")
        return False
