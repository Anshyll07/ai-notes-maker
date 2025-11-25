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
- Highlights: `<mark style="background-color: #ffc078; color: black;">`.
- Fonts: `<span style="font-family: FontName">`.
- Boxed Paragraphs: Use a `<div>` with `style="border: 1px solid #4b5563; padding: 10px; border-radius: 5px; background-color: #1f2937;"` to put a paragraph in a box.

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

def chat_with_ai(user_message, note_content, confirmation_mode, chat_history=None, pdf_context_path=None, selected_text=None, pdf_filename=None):
    if not API_KEY or not client:
        return {
            "response_text": "Error: Gemini API Key not configured.",
            "updated_html": note_content,
            "requires_confirmation": True
        }

    try:
        print(f"DEBUG: Starting chat_with_ai. Message: {user_message[:50]}...")
        # Read PDF if provided
        pdf_part = None
        upload_error = None
        if pdf_context_path:
            print(f"DEBUG: Processing PDF context: {pdf_context_path}")
            try:
                print(f"DEBUG: Reading PDF bytes: {pdf_context_path}")
                with open(pdf_context_path, 'rb') as f:
                    pdf_data = f.read()
                pdf_part = types.Part.from_bytes(
                    data=pdf_data,
                    mime_type='application/pdf'
                )
                print(f"DEBUG: PDF loaded successfully into Part")
            except Exception as e:
                print(f"DEBUG: Error reading PDF: {e}")
                upload_error = str(e)

        # --- First Pass: Decide if a tool is needed or if final response can be generated directly ---
        print("DEBUG: Preparing first pass prompt")
        initial_decision_prompt = f"""You are a powerful writing assistant. Your first job is to decide if you have enough information to respond to the user's request directly, or if you need to use a tool.

        You have one tool available:
        - `google_search`: Use this to find current information, facts, or data you don't know.

        Analyze the user's request.
        - If you need to search, you MUST return a single, valid JSON object with ONLY the following schema. Do not include any other text, explanations, or markdown.
          {{ "action": "tool_use", "tool": "google_search", "query": "your search query here" }}
        - If you can respond directly using the provided note content and your internal knowledge, you MUST return a single, valid JSON object with ONLY the following schema. Do not include any other text, explanations, or markdown.
          {{ "action": "generate_response" }}

        USER'S REQUEST:
        "{user_message}"
        
        CURRENT NOTE CONTENT:
        ```html
        {note_content}
        ```

        USER SELECTED TEXT (The user might be referring to this):
        "{selected_text if selected_text else 'No text selected'}"

        PDF CONTEXT:
        { f"A PDF file named '{pdf_filename}' has been attached for context." if pdf_part else f"No PDF uploaded. {(f'(Upload Error: {upload_error})' if upload_error else '')}" }
        """
        
        # Prepare contents for first pass
        first_pass_contents = []
        if pdf_part:
            first_pass_contents.append(pdf_part)
        first_pass_contents.append(initial_decision_prompt)

        print("DEBUG: Calling model for first pass (decision)")
        first_response_raw = client.models.generate_content(
            model=MODEL_NAME,
            contents=first_pass_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        print(f"DEBUG: First pass response received")
        
        first_response_json = json.loads(first_response_raw.text.strip().replace('```json', '').replace('```', '').strip())

        final_ai_prompt = ""
        search_results_context = ""
        response_mentions_search = False

        if first_response_json.get("action") == "tool_use" and first_response_json.get("tool") == "google_search":
            query = first_response_json.get("query")
            if query:
                search_results = execute_google_search(query)
                search_results_context = f"\n\n--- SEARCH RESULTS ---\n{search_results}\n----------------------\n"
                response_mentions_search = True
            else:
                # Fallback if query is missing
                search_results_context = "\n\n--- SEARCH FAILED: Query missing ---"
                response_mentions_search = True
        
        # --- Second Pass: Generate Final Answer (after tool use or directly) ---
        final_ai_prompt = f"""You are an expert writing assistant integrated into a notes application.
        Your task is to analyze a user's request and the current note content, and then perform the requested action.
        {BASE_PROMPT_CAPABILITIES}

        You MUST return a single, valid JSON object with the following exact schema:
        {{
          "response_text": "A short, conversational reply to the user confirming the action you took. { '(Mention that you searched for information.)' if response_mentions_search else '' }",
          "updated_html": "The full, new HTML content of the note after your modifications.",
          "requires_confirmation": "A boolean (true or false) indicating if this change is significant enough to require user confirmation."
        }}

        ORIGINAL USER'S REQUEST:
        "{user_message}"
        
        CURRENT NOTE CONTENT (in HTML):
        ```html
        {note_content}
        ```

        USER SELECTED TEXT (The user might be referring to this):
        "{selected_text if selected_text else 'No text selected'}"
        
        PDF CONTEXT:
        { f"A PDF file named '{pdf_filename}' has been attached for context." if pdf_part else f"No PDF uploaded. {(f'(Upload Error: {upload_error})' if upload_error else '')}" }

        {search_results_context}

        USER'S CONFIRMATION PREFERENCE: "{confirmation_mode}"

        INSTRUCTIONS:
        1.  **Analyze Request:** Understand the user's goal by matching it to the Capability Guides. Incorporate search results if provided.
        2.  **Modify HTML:** Apply the changes to the HTML content.
        3.  **Decide on Confirmation:** Based on the user's preference, set the `requires_confirmation` flag.
            - `always`: set to `false`.
            - `never`: set to `true`.
            - `think`: set to `true` for major changes (summaries, translations, major reformatting, ToC, significant content manipulation). Set to `false` for minor changes (fixing typos, bolding a word, adding a color to a phrase).
        4.  **Generate Reply:** Write a brief reply.
        5.  **Format Output:** Return ONLY the valid JSON object.
        """

        # Prepare contents for second pass
        second_pass_contents = []
        if pdf_part:
            second_pass_contents.append(pdf_part)
        second_pass_contents.append(final_ai_prompt)

        print("DEBUG: Calling model for second pass (final response)")
        final_response_raw = client.models.generate_content(
            model=MODEL_NAME,
            contents=second_pass_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        print(f"DEBUG: Second pass response received")
        
        final_response_json = json.loads(final_response_raw.text.strip().replace('```json', '').replace('```', '').strip())
        
        # Format LaTeX in updated_html
        if "updated_html" in final_response_json:
            final_response_json["updated_html"] = format_latex_for_tiptap(final_response_json["updated_html"])
        
        # Add search mention to response_text if a search was performed and not already included
        if response_mentions_search and "searched for" not in final_response_json["response_text"].lower():
            final_response_json["response_text"] = f"I searched for information. {final_response_json['response_text']}"

        return final_response_json

    except Exception as e:
        print(f"DEBUG: Error in chat_with_ai: {e}")
        error_response = {
            "response_text": f"Sorry, I encountered an error: {str(e)}",
            "updated_html": note_content,
            "requires_confirmation": True
        }
        return error_response

def transcribe_audio_with_ai(audio_path):
    """Transcribe audio file using Gemini AI"""
    if not API_KEY or not client:
        raise Exception("Gemini API Key not configured.")
    
    converted_path = None
    try:
        print(f"DEBUG: Transcribing audio: {audio_path}")
        
        # Verify file exists
        if not os.path.exists(audio_path):
            raise Exception(f"Audio file not found: {audio_path}")
        
        # Check file size
        file_size = os.path.getsize(audio_path)
        print(f"DEBUG: Audio file size: {file_size} bytes")
        
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

def chat_with_ai(user_message, note_content, confirmation_mode, chat_history=None, pdf_context_path=None, selected_text=None, pdf_filename=None, available_attachments=None):
    if not API_KEY or not client:
        return {
            "response_text": "Error: Gemini API Key not configured.",
            "updated_html": note_content,
            "requires_confirmation": True
        }

    try:
        print(f"DEBUG: Starting chat_with_ai. Message: {user_message[:50]}...")
        
        # --- Single Pass: Generate Answer ---
        contents = []
        
        # Load PDF if provided
        if pdf_context_path:
            print(f"DEBUG: Loading PDF context: {pdf_context_path}")
            try:
                with open(pdf_context_path, 'rb') as f:
                    pdf_data = f.read()
                pdf_part = types.Part.from_bytes(
                    data=pdf_data,
                    mime_type='application/pdf'
                )
                contents.append(pdf_part)
            except Exception as e:
                print(f"DEBUG: Error reading PDF: {e}")
                # We continue without the PDF if it fails

        # Construct Prompt
        prompt = f"""You are an expert writing assistant.
        {BASE_PROMPT_CAPABILITIES}

        You MUST return a single, valid JSON object with the following exact schema:
        {{
          "response_text": "A short, conversational reply.",
          "updated_html": "The full, new HTML content.",
          "requires_confirmation": "boolean"
        }}

        ORIGINAL USER REQUEST:
        "{user_message}"
        
        CURRENT NOTE CONTENT:
        ```html
        {note_content}
        ```

        USER SELECTED TEXT:
        "{selected_text if selected_text else 'No text selected'}"
        
        INSTRUCTIONS:
        1. If the user asks to edit the note, provide the FULL updated HTML in `updated_html`.
        2. If the user asks a question, answer it in `response_text` and keep `updated_html` same as `note_content` (or empty if no change).
        3. If `requires_confirmation` is true, the UI will ask the user to confirm changes.
        4. Use the provided PDF context (if any) to answer questions or generate content.
        """
        
        contents.append(prompt)

        print("DEBUG: Calling model for response")
        response_raw = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        try:
            response_json = json.loads(clean_json_string(response_raw.text), strict=False)
            
            # Format LaTeX in updated_html
            if "updated_html" in response_json:
                response_json["updated_html"] = format_latex_for_tiptap(response_json["updated_html"])

            return response_json
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}. Raw: {response_raw.text}")
            return {
                "response_text": "I encountered an error processing the response.",
                "updated_html": note_content,
                "requires_confirmation": False
            }

    except Exception as e:
        print(f"DEBUG: Error in chat_with_ai: {e}")
        error_response = {
            "response_text": f"Sorry, I encountered an error: {str(e)}",
            "updated_html": note_content,
            "requires_confirmation": True
        }
        return error_response