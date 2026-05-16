import newspaper
from newspaper import Article
import logging

logger = logging.getLogger(__name__)

def extract_article(url: str):
    """
    Extracts title, text, and metadata from a URL using newspaper4k.
    Returns a dict with the result or raises an exception with a reason.
    """
    try:
        article = Article(url)
        article.download()
        
        # Check for common download errors
        if article.download_state == 0:
            return {"status": "error", "reason": "invalid_url", "message": "Failed to download content. Check the URL."}
        
        article.parse()
        
        if not article.text or len(article.text) < 100:
            return {
                "status": "error", 
                "reason": "insufficient_content", 
                "message": "The article has too little readable text. It might be behind a paywall or login."
            }

        return {
            "status": "success",
            "title": article.title,
            "text": article.text,
            "authors": article.authors,
            "publish_date": str(article.publish_date) if article.publish_date else None,
            "top_image": article.top_image,
            "movies": article.movies,
            "summary": article.summary # newspaper can also summarize if called .nlp()
        }

    except Exception as e:
        err_str = str(e).lower()
        reason = "unknown_error"
        message = str(e)

        if "403" in err_str or "forbidden" in err_str or "cloudflare" in err_str:
            reason = "anti_bot_blocked"
            message = "Access denied by the website (Cloudflare or Anti-bot protection). This site is currently unsupported."
        elif "timeout" in err_str:
            reason = "timeout"
            message = "The request timed out. The website is too slow."
        elif "401" in err_str or "unauthorized" in err_str:
            reason = "paywall_login"
            message = "This article appears to be behind a paywall or requires login."
        
        return {"status": "error", "reason": reason, "message": message}
