
import os
import time
import threading
import pypdf
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=API_KEY) if API_KEY else None
MODEL_NAME = 'gemini-2.5-flash-preview-09-2025'


class APICooldownManager:
    """Manages API call cooldown to prevent rate limiting."""
    
    def __init__(self, min_delay_seconds=2.5):
        self._last_call_time = 0
        self._lock = threading.Lock()
        self.min_delay = min_delay_seconds
    
    def wait_if_needed(self):
        """Wait if not enough time has passed since the last API call."""
        with self._lock:
            current_time = time.time()
            elapsed = current_time - self._last_call_time
            
            if elapsed < self.min_delay:
                wait_time = self.min_delay - elapsed
                print(f"API cooldown: waiting {wait_time:.2f} seconds...")
                time.sleep(wait_time)
            
            self._last_call_time = time.time()

# Global cooldown manager instance
api_cooldown = APICooldownManager()

def summarize_pdf(file_path):
    """Generates a 50-100 word summary of the PDF content using Gemini."""
    if not API_KEY or not client:
        return "Summary unavailable (API Key missing)."
    
    try:
        # Wait for API cooldown
        api_cooldown.wait_if_needed()
        
        print(f"DEBUG: Summarizing PDF: {file_path}")
        
        # Read PDF bytes
        with open(file_path, 'rb') as f:
            pdf_data = f.read()
        
        prompt = """Provide a concise 50-100 word summary of this document. 
        Focus on describing WHAT this document contains (topics, subjects, key information).
        Do NOT provide a detailed analysis - just describe the content so someone can decide if it's relevant to their question.
        Keep it brief and factual."""
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                types.Part.from_bytes(
                    data=pdf_data,
                    mime_type='application/pdf',
                ),
                prompt
            ]
        )
        return response.text.strip()
    
    except Exception as e:
        return f"Error generating summary: {str(e)}"

def summarize_image(file_path):
    """Generates a 50-100 word summary of an image using Gemini."""
    if not API_KEY or not client:
        return "Summary unavailable (API Key missing)."
    
    try:
        # Wait for API cooldown
        api_cooldown.wait_if_needed()
        
        print(f"DEBUG: Summarizing Image: {file_path}")
        
        # Read image bytes
        with open(file_path, 'rb') as f:
            image_data = f.read()
        
        # Determine MIME type
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type or not mime_type.startswith('image/'):
            ext = file_path.lower().split('.')[-1]
            mime_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 
                       'gif': 'image/gif', 'webp': 'image/webp'}
            mime_type = mime_map.get(ext, 'image/jpeg')
        
        prompt = """Provide a concise 50-100 word summary of this image.
        Focus on describing WHAT this image contains (objects, scenes, text, key visual elements).
        Do NOT provide detailed analysis - just describe the content so someone can decide if it's relevant to their question.
        Keep it brief and factual."""
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                types.Part.from_bytes(
                    data=image_data,
                    mime_type=mime_type,
                ),
                prompt
            ]
        )
        
        return response.text.strip()
    
    except Exception as e:
        return f"Error generating summary: {str(e)}"


def generate_attachment_summary(file_path, filetype):
    """Generate summary based on file type."""
    if filetype == 'pdf':
        return summarize_pdf(file_path)
    elif filetype == 'image':
        return summarize_image(file_path)
    else:
        return "Summary not available for this file type."
