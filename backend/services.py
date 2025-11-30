import os
import json
import re
from dotenv import load_dotenv
from googlesearch import search
from google import genai
from google.genai import types
import pypdf
import io

load_dotenv()

API_KEY = os.getenv('GEMINI_API_KEY')

# Initialize the client
client = genai.Client(api_key=API_KEY) if API_KEY else None

MODEL_NAME = 'gemini-2.5-flash-preview-09-2025'

def format_latex_for_tiptap(text):
    """Formats LaTeX strings for Tiptap Mathematics extension."""
    # Block math: $$...$$ -> <div data-type="block-math" data-latex="..."></div>
    text = re.sub(r'\$\$(.*?)\$\$', r'<div data-type="block-math" data-latex="\1"></div>', text, flags=re.DOTALL)
    # Block math: \[...\] -> <div data-type="block-math" data-latex="..."></div>
    text = re.sub(r'\\\[(.*?)\\\]', r'<div data-type="block-math" data-latex="\1"></div>', text, flags=re.DOTALL)
    
    # Inline math: $...$ -> <span data-type="inline-math" data-latex="..."></span>
    text = re.sub(r'\$([^$]+)\$', r'<span data-type="inline-math" data-latex="\1"></span>', text)
    # Inline math: \(...\) -> <span data-type="inline-math" data-latex="..."></span>
    text = re.sub(r'\\\((.*?)\\\)', r'<span data-type="inline-math" data-latex="\1"></span>', text)
    return text

def execute_google_search(query):
    """Executes a Google search and returns the top 5 results as a string."""
    try:
        search_results = list(search(query, num_results=5))
        return "\n".join([f"- {result}" for result in search_results])
    except Exception as e:
        return f"An error occurred during search: {str(e)}"

def extract_text_from_pdf(file_stream):
    """Extracts text from a PDF file stream."""
    try:
        reader = pypdf.PdfReader(file_stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        raise e

# Define a base prompt that includes all the AI's capabilities
BASE_PROMPT_CAPABILITIES = """
### CAPABILITY GUIDES ###

**1. HTML STYLING GUIDE:**
When asked to beautify, format, or style, use these tags:
- Headings: `<h2>` and `<h3>`.
- Emphasis: `<b>` or `<strong>`.
- Lists: `<ul>` and `<li>`.

    **6. IMAGE SEARCH GUIDELINES:**
    - To insert a SINGLE image, use the placeholder: {{IMAGE: search_query}}
    - To insert a GALLERY (collage of 4 images), use: {{GALLERY: search_query}}
    - To insert a ROW of images (side-by-side in one line), use: {{ROW: search_query}}
    - Use {{ROW: ...}} when the user asks for "images in one line", "side-by-side", or "horizontal list".
    - The frontend will automatically arrange them in a scrollable row.
    - Do NOT provide image URLs directly.
    - Example: "Here is a row of cars: {{ROW: luxury cars}}"

    **CRITICAL INSTRUCTION ON IMAGE USAGE:**
    - You HAVE the capability to search for images.
    - You SHOULD search for images when they add value to the content (e.g., explaining a concept, showing an object).
    - You MUST NOT search for images for every single response. If the user's request is simple conversation (e.g., "Hello", "Thanks") or purely text-based, DO NOT insert images.
    - Be judicious. Only use image search when the user explicitly requests it. {like he says to add image for better understanding}
    - **NEGATIVE CONSTRAINTS:**
        - If the user asks to "color", "highlight", "bold", "format", or "style" text, DO NOT search for images.
        - If the user provides a code snippet or text and asks to "fix", "explain", or "modify" it, DO NOT search for images unless explicitly asked.
        - Focus on the TEXT manipulation for these requests.
    
"""

def decide_file_needs(user_message, note_content, attachment_summaries, selected_text=None):
    """
    Step 1: Decide if full files are needed based on summaries.
    Returns: {"need_files": bool, "file_numbers": [], "reason": str}
    """
    if not API_KEY or not client:
        return {"need_files": False, "error": "API Key missing"}

    try:
        # Build context with summaries
        context = f"Current note content:\n{note_content}\n\n"
        
        if attachment_summaries and len(attachment_summaries) > 0:
            context += "Available attachments (SUMMARIES ONLY):\n"
            for idx, att in enumerate(attachment_summaries, 1):
                status = att.get('summary_status', 'unknown')
                if status == 'complete' and att.get('summary'):
                    context += f"{idx}. {att['filename']}: {att['summary']}\n"
                else:
                    context += f"{idx}. {att['filename']}: (summary not available)\n"
        else:
            return {"need_files": False} # No attachments to analyze

        prompt = f"""You are a smart assistant. Your ONLY job is to decide if you need to read the FULL CONTENT of any attached file to answer the user's request.

{context}

User Request: "{user_message}"
Selected Text: "{selected_text if selected_text else 'None'}"

INSTRUCTIONS:
1. If the user asks to "analyse", "summarize", "explain", or "read" a specific file, you MUST request that file.
2. If the user asks a specific question that might be in the file but not in the summary, request the file.
3. If the summary is sufficient to answer (e.g. "what is this file about?"), do NOT request the file.

Return ONLY JSON:
{{
  "need_files": true/false,
  "file_numbers": [1, 2],
  "reason": "explanation"
}}
"""
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        return json.loads(clean_json_string(response.text.strip()), strict=False)

    except Exception as e:
        print(f"DEBUG: Error in decide_file_needs: {e}")
        return {"need_files": False, "error": str(e)}

def generate_ai_response(user_message, note_content, confirmation_mode, chat_history=None, file_attachments=None, selected_text=None):
    """
    Step 2: Generate final response using full file content (if provided).
    file_attachments: List of dicts with 'file_path' and 'filetype'
    """
    if not API_KEY or not client:
        return {
            "response_text": "Error: Gemini API Key not configured.",
            "updated_html": note_content,
            "requires_confirmation": True
        }

    try:
        contents = []
        
        # Add full file contents if available
        if file_attachments:
            print(f"DEBUG: Processing {len(file_attachments)} attachments")
            import mimetypes
            for attachment in file_attachments:
                file_path = attachment.get('file_path')
                filetype = attachment.get('filetype')
                print(f"DEBUG: Checking attachment: {file_path} ({filetype})")
                
                if not file_path or not os.path.exists(file_path):
                    print(f"DEBUG: File not found: {file_path}")
                    continue
                
                # Read file bytes
                with open(file_path, 'rb') as f:
                    file_data = f.read()
                print(f"DEBUG: Read {len(file_data)} bytes from {file_path}")
                
                # Determine MIME type
                if filetype == 'pdf':
                    mime_type = 'application/pdf'
                elif filetype == 'image':
                    mime_type, _ = mimetypes.guess_type(file_path)
                    if not mime_type or not mime_type.startswith('image/'):
                        ext = file_path.lower().split('.')[-1]
                        mime_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 
                                   'gif': 'image/gif', 'webp': 'image/webp'}
                        mime_type = mime_map.get(ext, 'image/jpeg')
                else:
                    print(f"DEBUG: Skipping unsupported filetype: {filetype}")
                    continue
                
                if len(file_data) == 0:
                    print(f"DEBUG: File is empty: {file_path}")
                    continue

                print(f"DEBUG: Adding part with mime_type: {mime_type}")
                # Add file as Part.from_bytes (same as summary generation)
                contents.append(
                    types.Part.from_bytes(
                        data=file_data,
                        mime_type=mime_type,
                    )
                )
        else:
            print("DEBUG: No file_attachments provided to generate_ai_response")


        file_context_msg = ""
        if file_attachments:
            file_names = [att.get('filename', 'unknown') for att in file_attachments]
            file_context_msg = f"""
IMPORTANT SYSTEM INSTRUCTION:
I have attached {len(file_attachments)} file(s) to this request: {', '.join(file_names)}.
These files are provided as 'Part' objects in this request.
You HAVE access to them.
The user is asking about these specific files.
When the user mentions "{file_names[0]}" or similar, they are referring to the attached file content.
You MUST read the attached file content and answer the user's question based on it.
DO NOT refuse. DO NOT say you cannot access local files. The files are RIGHT HERE in the context.
"""

        # Format chat history
        chat_history_str = ""
        if chat_history:
            for msg in chat_history:
                sender = "User" if msg.get('sender') == 'user' else "Assistant"
                chat_history_str += f"{sender}: {msg.get('text')}\n"

        prompt = f"""{BASE_PROMPT_CAPABILITIES}

{file_context_msg}

Current note content:
```html
{note_content}
```

User question: {user_message}
Selected text: {selected_text if selected_text else 'None'}

Chat History:
{chat_history_str}

INSTRUCTIONS:
1. Answer the user's question or perform the requested edit.
2. The user has explicitly attached files. You MUST read them and use their FULL CONTENT.
3. If asked to edit, provide the full updated HTML.

Return JSON:
{{
  "response_text": "your answer",
  "updated_html": "FULL updated content (always provide this as backup)",
  "changes": [
      {{
          "find": "exact unique string to replace",
          "replace": "new string"
      }}
  ],
  "requires_confirmation": false
**CRITICAL INSTRUCTION FOR EDITS:**
- **PRIORITIZE using the `changes` list.**
- UNLESS you are rewriting the ENTIRE document from scratch, you MUST use `changes`.
- Even for large sections, if you can identify specific blocks to replace, use `changes`.
- The `find` string must be UNIQUE and EXACTLY match the existing HTML.
- The `replace` string is what it should become.
- **Why?** This prevents overwriting the user's work if they type while you are thinking.
- ONLY use `updated_html` (with empty `changes`) if the edit is so complex that find/replace is impossible.

**CONCURRENT EDIT AWARENESS:**

- To ensure your changes merge correctly with their new edits:
    1. **Minimize your edit footprint.** Only change exactly what is requested. Do not reformat surrounding text.
    2. **Preserve context.** Keep unique identifiers or surrounding phrases intact so the system can locate the correct place to apply changes.
    3. **Do not undo user actions.** If the user asks you to do something, but the text implies they might have already started doing it, be careful not to duplicate or mess it up.
"""
        contents.append(prompt)
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        response_json = json.loads(clean_json_string(response.text.strip()), strict=False)
        
        # Handle case where AI returns a list instead of a dict
        if isinstance(response_json, list):
            if len(response_json) > 0 and isinstance(response_json[0], dict):
                response_json = response_json[0]
            else:
                # Fallback if list is empty or doesn't contain dict
                return {
                    "response_text": "I understood your request but generated an unexpected response format. Please try again.",
                    "updated_html": note_content,
                    "requires_confirmation": False
                }

        if "updated_html" in response_json:
            response_json["updated_html"] = format_latex_for_tiptap(response_json["updated_html"])
            
        return response_json

    except Exception as e:

        return {
            "response_text": f"Sorry, I encountered an error: {str(e)}",
            "updated_html": note_content,
            "requires_confirmation": True
        }


def transcribe_audio_with_ai(audio_path):
    """Transcribe audio file using Gemini AI"""
    if not API_KEY or not client:
        raise Exception("Gemini API Key not configured.")
    
    converted_path = None
    try:

        
        # Verify file exists
        if not os.path.exists(audio_path):
            raise Exception(f"Audio file not found: {audio_path}")
        
        # Check file size
        file_size = os.path.getsize(audio_path)

        
        if file_size == 0:
            raise Exception("Audio file is empty")
        
        # Convert WebM to MP3 for better compatibility
        try:
            from pydub import AudioSegment
            print(f"DEBUG: Converting WebM to MP3...")
            
            audio = AudioSegment.from_file(audio_path, format="webm")
            converted_path = audio_path.replace('.webm', '.mp3')
            audio.export(converted_path, format="mp3")
            
            upload_path = converted_path
            print(f"DEBUG: Converted to MP3: {converted_path}")
        except ImportError:
            print(f"DEBUG: pydub not available, using WebM directly")
            upload_path = audio_path
        except Exception as conv_error:
            print(f"DEBUG: Conversion failed: {conv_error}, using WebM directly")
            upload_path = audio_path
        
        # Upload audio file
        print(f"DEBUG: Uploading audio file to Gemini API...")
        myfile = client.files.upload(file=upload_path)
        print(f"DEBUG: Audio uploaded: {myfile.name}")
        
        # Generate transcription
        print(f"DEBUG: Requesting transcription from Gemini...")
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=["Please transcribe this audio clip. Provide only the transcribed text, nothing else.", myfile]
        )
        
        print(f"DEBUG: Transcription received successfully")
        
        # Cleanup converted file
        if converted_path and os.path.exists(converted_path):
            os.unlink(converted_path)
        
        
        if not response.text or response.text.strip() == "":
            raise Exception("Gemini returned empty transcription")
        
        return response.text
        
    except Exception as e:
        print(f"ERROR: Error transcribing audio: {e}")
        
        # Cleanup on error
        if converted_path and os.path.exists(converted_path):
            try:
                os.unlink(converted_path)
            except:
                pass
        
        raise Exception(f"Transcription failed: {str(e)}")



def clean_json_string(json_str):
    """Cleans a JSON string by removing control characters and markdown formatting."""
    # Remove markdown code blocks
    json_str = json_str.strip().replace('```json', '').replace('```', '').strip()
    
    # Robust backslash escaping using a manual loop
    # We want to escape backslashes that are NOT part of a valid JSON escape sequence.
    # Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
    # However, for LaTeX content, \f (form feed) is usually \frac, \t is \text, etc.
    # So we will treat \b, \f, \n, \r, \t as "invalid" (i.e., needing escape) to preserve the literal backslash for LaTeX.
    # We will ONLY preserve \", \\, \/, and valid \uXXXX.
    
    result = []
    i = 0
    n = len(json_str)
    
    while i < n:
        char = json_str[i]
        
        if char == '\\':
            # Check next char
            if i + 1 < n:
                next_char = json_str[i+1]
                
                # Preserve \" (quote), \\ (backslash), \/ (slash), \n (newline), \r (return)
                if next_char in '"\\/nr':
                    result.append('\\')
                    result.append(next_char)
                    i += 2
                    continue
                
                # Check for unicode \uXXXX
                elif next_char == 'u':
                    # Check if next 4 chars are hex
                    if i + 5 < n:
                        hex_chars = json_str[i+2:i+6]
                        import string
                        if all(c in string.hexdigits for c in hex_chars):
                            # Valid unicode, preserve it
                            result.append('\\u')
                            result.append(hex_chars)
                            i += 6
                            continue
                    
                    # Not valid unicode, escape the backslash
                    result.append('\\\\')
                    i += 1
                    continue
                
                else:
                    # All other follows (b, f, n, r, t, and other chars) -> Escape the backslash
                    # This turns \frac into \\frac, \n into \\n, \alpha into \\alpha
                    result.append('\\\\')
                    i += 1
                    continue
            else:
                # Backslash at end of string -> Escape it
                result.append('\\\\')
                i += 1
                continue
        else:
            result.append(char)
            i += 1
            
    return "".join(result)



from summary_functions import generate_attachment_summary
