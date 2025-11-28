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
- Colors: `<span style='color: #hexcode'>`. Palette: #60a5fa (blue), #a78bfa (purple), #f472b6 (pink), #34d399 (green), #fbbf24 (yellow).
- Highlights: Use `<mark style="background-color: rgba(r, g, b, 0.3); color: inherit;">`.
  - Yellow Highlight: `background-color: rgba(255, 213, 0, 0.3)`
  - Green Highlight: `background-color: rgba(0, 255, 0, 0.2)`
  - Blue Highlight: `background-color: rgba(0, 100, 255, 0.2)`
  - Pink Highlight: `background-color: rgba(255, 0, 255, 0.2)`
  - Purple Highlight: `background-color: rgba(128, 0, 128, 0.2)`
- Fonts: `<span style="font-family: 'Inter', sans-serif">` or `<span style="font-family: 'Georgia', serif">`.
- Boxed Paragraphs: Use a `<div>` with `style="border: 1px solid #4b5563; padding: 12px; border-radius: 8px; background-color: rgba(31, 41, 55, 0.5);"` to put a paragraph in a box.

**2. CONTENT MANIPULATION GUIDE:**
- You can re-order content. If asked to "move the last paragraph to the top," modify the order of HTML elements.

**3. CONTENT GENERATION & STRUCTURING GUIDE:**
- **Table of Contents:** If asked to "create a table of contents," find all `<h2>` and `<h3>` tags. Then, insert an unordered list at the top of the document with plain text list items, each containing the text of a heading. DO NOT use `<a>` tags or any linking mechanism.
- **Structured Formatting:** If asked to "format this as a pros and cons list," restructure the user's text into a two-column HTML table or two distinct lists with `<h2>` headings for "Pros" and "Cons".

**4. CONTENT TRANSFORMATION GUIDE:**
- **Tone & Persona:** If asked to "make this sound more formal" or "explain this like I'm five," rewrite the text content while preserving the HTML structure as much as possible.
- **Translation:** If asked to "translate this to Spanish," translate the text within the HTML tags, leaving the tags themselves in English.

**5. MATH FORMATTING GUIDE:**
- **Always** put every mathematical formula on its own new line.
- **Always** use block LaTeX syntax `$$...$$` for every formula, even simple ones like `$$x=y$$`.
- **Never** use inline LaTeX `$ ... $` unless it is embedded strictly within a sentence and cannot be separated. But prefer block math `$$...$$` whenever possible for better visibility.
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

def generate_ai_response(user_message, note_content, confirmation_mode, chat_history=None, full_file_contents=None, selected_text=None):
    """
    Step 2: Generate final response using full content (if provided).
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
        if full_file_contents:
            contents.extend(full_file_contents)


        prompt = f"""{BASE_PROMPT_CAPABILITIES}

Current note content:
```html
{note_content}
```

User question: {user_message}
Selected text: {selected_text if selected_text else 'None'}

INSTRUCTIONS:
1. Answer the user's question or perform the requested edit.
2. If full files were provided, use them to give a detailed, accurate answer.
3. If asked to edit, provide the full updated HTML.

Return JSON:
{{
  "response_text": "your answer",
  "updated_html": "updated content or same as original",
  "requires_confirmation": false
}}
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

def summarize_pdf(file_path):
    """Generates a summary of the PDF content using Gemini."""
    if not API_KEY or not client:
        return "Summary unavailable (API Key missing)."
    
    try:
        print(f"DEBUG: Summarizing PDF: {file_path}")
        with open(file_path, 'rb') as f:
            pdf_data = f.read()
        
        pdf_part = types.Part.from_bytes(
            data=pdf_data,
            mime_type='application/pdf'
        )
        
        prompt = "Please provide a concise summary of this document (max 2-3 sentences) describing what it contains. This summary will be used to decide if this document is relevant to a user's query."
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[prompt, pdf_part]
        )
        
        return response.text.strip()
    except Exception as e:
        print(f"Error summarizing PDF: {e}")
        return "Summary unavailable (Error)."

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
