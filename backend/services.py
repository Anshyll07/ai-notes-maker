import os
import json
import re
from dotenv import load_dotenv
from googlesearch import search
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv('GEMINI_API_KEY')

# Initialize the client
client = genai.Client(api_key=API_KEY) if API_KEY else None

MODEL_NAME = 'gemini-2.5-flash-preview-09-2025'

def format_latex_for_tiptap(text):
    """Formats LaTeX strings for Tiptap Mathematics extension."""
    # Block math: $$...$$ -> <div data-type="block-math" data-latex="..."></div>
    text = re.sub(r'\$\$(.*?)\$\$', r'<div data-type="block-math" data-latex="\1"></div>', text, flags=re.DOTALL)
    
    # Inline math: $...$ -> <span data-type="inline-math" data-latex="..."></span>
    text = re.sub(r'\$([^$]+)\$', r'<span data-type="inline-math" data-latex="\1"></span>', text)
    return text

def execute_google_search(query):
    """Executes a Google search and returns the top 5 results as a string."""
    try:
        search_results = list(search(query, num_results=5))
        return "\n".join([f"- {result}" for result in search_results])
    except Exception as e:
        return f"An error occurred during search: {str(e)}"

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

def chat_with_ai(user_message, note_content, confirmation_mode, chat_history=None, pdf_context_path=None, selected_text=None):
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
        { "A PDF file has been attached for context." if pdf_part else f"No PDF uploaded. {f'(Upload Error: {upload_error})' if upload_error else ''}" }
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
                search_results_context = "\n\n--- SEARCH FAILED: Query missing ---\n"
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
        { "A PDF file has been attached for context." if pdf_part else f"No PDF uploaded. {f'(Upload Error: {upload_error})' if upload_error else ''}" }

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
