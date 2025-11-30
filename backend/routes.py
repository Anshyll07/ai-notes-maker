from flask import Blueprint, request, jsonify, send_file, send_from_directory
from services import decide_file_needs, generate_ai_response, extract_text_from_pdf, generate_attachment_summary
from models import db, User, Note, ChatMessage, Folder, Attachment
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
import io
import uuid
import os
import json
import threading
from werkzeug.utils import secure_filename
from google import genai
from google.genai import types
import mimetypes

api_bp = Blueprint('api', __name__)
bcrypt = Bcrypt()

UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'} # Define allowed extensions

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Auth Routes ---

@api_bp.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, password_hash=hashed_password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User created successfully'}), 201

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()

    if user and bcrypt.check_password_hash(user.password_hash, password):
        access_token = create_access_token(identity=str(user.id))
        return jsonify({'access_token': access_token, 'username': user.username}), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

# --- Note Routes ---

@api_bp.route('/notes', methods=['GET'])
@jwt_required()
def get_notes():
    current_user_id = int(get_jwt_identity())
    notes = Note.query.filter_by(user_id=current_user_id).order_by(Note.updated_at.desc()).all()
    
    notes_data = []
    for note in notes:
        # Count chat messages for this note
        chat_count = ChatMessage.query.filter_by(note_id=note.id).count()

        # Get attachments for this note
        attachments_data = []
        for attachment in note.attachments:
            attachments_data.append({
                'id': attachment.id,
                'filename': attachment.filename,
                'filetype': attachment.filetype,
                'url': f'/api/attachments/{attachment.filepath}',
                'summary': attachment.summary,
                'summaryStatus': attachment.summary_status
            })
        
        notes_data.append({
            'id': note.id,
            'title': note.title,
            'content': note.content,
            'color': note.color,
            'icon': note.icon,
            'folderId': note.folder_id,
            'isHiddenFromTopBar': note.is_hidden_from_top_bar,
            'createdAt': int(note.created_at.timestamp() * 1000),
            'updatedAt': int(note.updated_at.timestamp() * 1000),
            'chatCount': chat_count,
            'attachments': attachments_data
        })
    
    return jsonify(notes_data), 200

@api_bp.route('/notes', methods=['POST'])
@jwt_required()
def create_note():
    current_user_id = int(get_jwt_identity())
    data = request.json
    
    new_note = Note(
        id=str(uuid.uuid4()),
        user_id=current_user_id,
        title=data.get('title', 'New Page'),
        content=data.get('content', ''),
        color=data.get('color'),
        icon=data.get('icon', '📝')
    )
    
    db.session.add(new_note)
    db.session.commit()
    
    return jsonify({
        'id': new_note.id,
        'title': new_note.title,
        'content': new_note.content,
        'color': new_note.color,
        'icon': new_note.icon,
        'folderId': new_note.folder_id,
        'isHiddenFromTopBar': new_note.is_hidden_from_top_bar,
        'createdAt': int(new_note.created_at.timestamp() * 1000),
        'updatedAt': int(new_note.updated_at.timestamp() * 1000),
        'chatCount': 0
    }), 201

@api_bp.route('/notes/<note_id>', methods=['PUT'])
@jwt_required()
def update_note(note_id):
    current_user_id = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()
    
    if not note:
        return jsonify({'error': 'Note not found'}), 404
        
    data = request.json
    if 'title' in data:
        note.title = data['title']
    if 'content' in data:
        note.content = data['content']
    if 'color' in data:
        note.color = data['color']
    if 'icon' in data:
        note.icon = data['icon']
    if 'folderId' in data:
        note.folder_id = data['folderId']
    if 'isHiddenFromTopBar' in data:
        note.is_hidden_from_top_bar = data['isHiddenFromTopBar']
        
    db.session.commit()
    return jsonify({'message': 'Note updated'}), 200

def cleanup_attachment_files(attachment):
    """Helper to delete attachment file and its summary from disk."""
    try:
        filepath = os.path.join(UPLOAD_FOLDER, attachment.filepath)
        if os.path.exists(filepath):
            os.remove(filepath)
        
        # Remove summary file if exists
        summary_path = filepath + '.json'
        if os.path.exists(summary_path):
            os.remove(summary_path)
            
    except Exception as e:
        print(f"Error deleting file {attachment.filepath}: {e}")

import re

@api_bp.route('/notes/<note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    current_user_id = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()
    
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    
    # 1. Delete attachment files from disk
    for attachment in note.attachments:
        cleanup_attachment_files(attachment)

    # 2. Delete AI-downloaded images from disk
    # Find all image src in content that match /api/downloaded_images/
    if note.content:
        # Regex to find src="/api/downloaded_images/filename.ext"
        # Matches: src=".../api/downloaded_images/..."
        matches = re.findall(r'src="[^"]*/api/downloaded_images/([^"]+)"', note.content)
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        download_dir = os.path.join(base_dir, "downloaded_images")
        
        for filename in matches:
            try:
                # Security check: ensure filename is just a filename, no path traversal
                safe_filename = secure_filename(filename)
                file_path = os.path.join(download_dir, safe_filename)
                
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Cleaned up image: {safe_filename}")
            except Exception as e:
                print(f"Error cleaning up image {filename}: {e}")
        
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Note deleted'}), 200

@api_bp.route('/cleanup-images', methods=['POST'])
def cleanup_images():
    """
    Deletes a list of images from the downloaded_images directory.
    Expects JSON: { "urls": ["http://.../filename.jpg", ...] }
    """
    try:
        data = request.get_json()
        urls = data.get('urls', [])
        
        if not urls:
            return jsonify({'message': 'No URLs provided'}), 200
            
        base_dir = os.path.dirname(os.path.abspath(__file__))
        download_dir = os.path.join(base_dir, "downloaded_images")
        
        deleted_count = 0
        
        for url in urls:
            try:
                # Extract filename from URL
                # URL format: .../api/downloaded_images/filename.ext
                if '/api/downloaded_images/' in url:
                    filename = url.split('/api/downloaded_images/')[-1]
                    safe_filename = secure_filename(filename)
                    file_path = os.path.join(download_dir, safe_filename)
                    
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        deleted_count += 1
                        print(f"Cleanup: Deleted {safe_filename}")
            except Exception as e:
                print(f"Error deleting {url}: {e}")
                
        return jsonify({'message': f'Cleaned up {deleted_count} images'}), 200
        
    except Exception as e:
        print(f"Cleanup failed: {e}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/notes/<note_id>/attachments', methods=['POST'])
@jwt_required()
def upload_attachment(note_id):
    current_user_id = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()

    if not note:
        return jsonify({'error': 'Note not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected for uploading'}), 400

    if file and allowed_file(file.filename):
        original_filename = secure_filename(file.filename)
        # Generate a unique filename to prevent collisions
        unique_filename = str(uuid.uuid4()) + os.path.splitext(original_filename)[1]
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(filepath)

        file_extension = unique_filename.rsplit('.', 1)[1].lower()
        filetype = 'image' if file_extension in {'png', 'jpg', 'jpeg', 'gif'} else 'pdf'

        # Create attachment with pending status
        new_attachment = Attachment(
            note_id=note_id,
            filename=original_filename,
            filepath=unique_filename,
            filetype=filetype,
            summary_status='pending'
        )
        db.session.add(new_attachment)
        db.session.commit()
        
        attachment_id = new_attachment.id
        
        # Start background summary generation
        def generate_summary_background():
            from flask import copy_current_request_context
            @copy_current_request_context
            def run_in_thread():
                from flask import current_app
                with current_app.app_context():
                    try:
                        # Update status to processing
                        attachment = Attachment.query.get(attachment_id)
                        if attachment:
                            attachment.summary_status = 'processing'
                            db.session.commit()
                        
                        # Generate summary (includes cooldown)
                        summary = generate_attachment_summary(filepath, filetype)
                        
                        # Update database with summary
                        attachment = Attachment.query.get(attachment_id)
                        if attachment:
                            attachment.summary = summary
                            attachment.summary_status = 'complete'
                            db.session.commit()
                    except Exception as e:
                        print(f"ERROR: Summary generation failed: {e}")
                        import traceback
                        traceback.print_exc()
                        try:
                            attachment = Attachment.query.get(attachment_id)
                            if attachment:
                                attachment.summary_status = 'failed'
                                attachment.summary = f"Failed to generate summary: {str(e)[:100]}"
                                db.session.commit()
                        except:
                            pass
            
            thread = threading.Thread(target=run_in_thread)
            thread.daemon = True
            thread.start()
        
        generate_summary_background()

        return jsonify({
            'id': new_attachment.id,
            'filename': new_attachment.filename,
            'filetype': new_attachment.filetype,
            'url': f'/api/attachments/{new_attachment.filepath}',
            'summary': new_attachment.summary,
            'summaryStatus': new_attachment.summary_status
        }), 201
    else:
        return jsonify({'error': 'Allowed file types are png, jpg, jpeg, gif, pdf'}), 400

@api_bp.route('/attachments/<filename>', methods=['GET'])
def serve_attachment(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)



@api_bp.route('/attachments/status/<int:attachment_id>', methods=['GET'])
@jwt_required()
def get_attachment_status(attachment_id):
    """Get attachment status for polling summary generation progress."""
    current_user_id = int(get_jwt_identity())
    
    attachment = Attachment.query.get(attachment_id)
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    # Verify user owns this attachment's note
    note = Note.query.get(attachment.note_id)
    if not note or note.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({
        'id': attachment.id,
        'filename': attachment.filename,
        'filetype': attachment.filetype,
        'url': f'/api/attachments/{attachment.filepath}',
        'summary': attachment.summary,
        'summaryStatus': attachment.summary_status
    }), 200

@api_bp.route('/attachments/<int:attachment_id>/regenerate-summary', methods=['POST'])
@jwt_required()
def regenerate_summary(attachment_id):
    """Regenerate summary for an attachment."""
    current_user_id = int(get_jwt_identity())
    
    attachment = Attachment.query.get(attachment_id)
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    # Verify user owns this attachment's note
    note = Note.query.get(attachment.note_id)
    if not note or note.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Reset summary status to pending
    attachment.summary_status = 'pending'
    attachment.summary = None
    db.session.commit()
    
    # Get file path
    filepath = os.path.join(UPLOAD_FOLDER, attachment.filepath)
    if not os.path.exists(filepath):
        attachment.summary_status = 'failed'
        attachment.summary = 'File not found'
        db.session.commit()
        return jsonify({'error': 'File not found'}), 404
    
    # Start background summary generation
    def generate_summary_background():
        from flask import copy_current_request_context
        @copy_current_request_context
        def run_in_thread():
            from flask import current_app
            with current_app.app_context():
                try:
                    # Update status to processing
                    att = Attachment.query.get(attachment_id)
                    if att and att.summary_status == 'pending':
                        att.summary_status = 'processing'
                        db.session.commit()
                    
                    # Generate summary (includes cooldown)
                    summary = generate_attachment_summary(filepath, attachment.filetype)
                    
                    # Update database with summary
                    att = Attachment.query.get(attachment_id)
                    if att and att.summary_status == 'processing':
                        att.summary = summary
                        att.summary_status = 'complete'
                        db.session.commit()
                except Exception as e:
                    print(f"ERROR: Summary regeneration failed: {e}")
                    import traceback
                    traceback.print_exc()
                    try:
                        att = Attachment.query.get(attachment_id)
                        if att:
                            att.summary_status = 'failed'
                            att.summary = f"Failed to generate summary: {str(e)[:100]}"
                            db.session.commit()
                    except:
                        pass
        
        thread = threading.Thread(target=run_in_thread)
        thread.daemon = True
        thread.start()
    
    generate_summary_background()
    
    return jsonify({
        'id': attachment.id,
        'filename': attachment.filename,
        'summaryStatus': 'pending',
        'message': 'Summary regeneration started'
    }), 200

@api_bp.route('/attachments/<int:attachment_id>/cancel-summary', methods=['POST'])
@jwt_required()
def cancel_summary(attachment_id):
    """Cancel summary generation for an attachment."""
    current_user_id = int(get_jwt_identity())
    
    attachment = Attachment.query.get(attachment_id)
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404
    
    # Verify user owns this attachment's note
    note = Note.query.get(attachment.note_id)
    if not note or note.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Set status to cancelled (the background thread will check this)
    if attachment.summary_status in ['pending', 'processing']:
        attachment.summary_status = 'cancelled'
        attachment.summary = 'Summary generation cancelled by user'
        db.session.commit()
    
    return jsonify({
        'id': attachment.id,
        'filename': attachment.filename,
        'summaryStatus': attachment.summary_status,
        'message': 'Summary generation cancelled'
    }), 200


@api_bp.route('/attachments/<int:attachment_id>', methods=['DELETE'])
@jwt_required()
def delete_attachment(attachment_id):
    current_user_id = int(get_jwt_identity())
    
    attachment = Attachment.query.get(attachment_id)
    if not attachment:
        return jsonify({'error': 'Attachment not found'}), 404

    note = Note.query.get(attachment.note_id)
    if not note or note.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Clean up files from disk
    cleanup_attachment_files(attachment)

    db.session.delete(attachment)
    db.session.commit()

    return jsonify({'message': 'Attachment deleted'}), 200

# --- Chat Routes ---

@api_bp.route('/notes/<note_id>/chat', methods=['GET'])
@jwt_required()
def get_chat_history(note_id):
    current_user_id = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()
    
    if not note:
        return jsonify({'error': 'Note not found'}), 404
        
    messages = ChatMessage.query.filter_by(note_id=note_id).order_by(ChatMessage.timestamp.asc()).all()
    
    chat_history = [{'sender': msg.sender, 'text': msg.text} for msg in messages]
    return jsonify(chat_history), 200

@api_bp.route('/notes/<note_id>/chat', methods=['DELETE'])
@jwt_required()
def delete_chat_history(note_id):
    current_user_id = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()
    
    if not note:
        return jsonify({'error': 'Note not found'}), 404
        
    # Delete all chat messages for this note
    ChatMessage.query.filter_by(note_id=note_id).delete()
    db.session.commit()
    
    return jsonify({'message': 'Chat history cleared'}), 200

@api_bp.route('/folders', methods=['GET'])
@jwt_required()
def get_folders():
    current_user_id = int(get_jwt_identity())
    folders = Folder.query.filter_by(user_id=current_user_id).order_by(Folder.created_at.desc()).all()
    
    folders_data = []
    for folder in folders:
        folders_data.append({
            'id': folder.id,
            'name': folder.name,
            'color': folder.color,
            'icon': folder.icon,
            'createdAt': int(folder.created_at.timestamp() * 1000),
            'updatedAt': int(folder.updated_at.timestamp() * 1000)
        })
    
    return jsonify(folders_data), 200

@api_bp.route('/folders', methods=['POST'])
@jwt_required()
def create_folder():
    current_user_id = int(get_jwt_identity())
    data = request.json
    
    new_folder = Folder(
        id=str(uuid.uuid4()),
        user_id=current_user_id,
        name=data.get('name', 'New Folder'),
        color=data.get('color'),
        icon=data.get('icon', '📁')
    )
    
    db.session.add(new_folder)
    db.session.commit()
    
    return jsonify({
        'id': new_folder.id,
        'name': new_folder.name,
        'color': new_folder.color,
        'icon': new_folder.icon,
        'createdAt': int(new_folder.created_at.timestamp() * 1000),
        'updatedAt': int(new_folder.updated_at.timestamp() * 1000)
    }), 201

@api_bp.route('/folders/<folder_id>', methods=['PUT'])
@jwt_required()
def update_folder(folder_id):
    current_user_id = int(get_jwt_identity())
    folder = Folder.query.filter_by(id=folder_id, user_id=current_user_id).first()
    
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
        
    data = request.json
    if 'name' in data:
        folder.name = data['name']
    if 'color' in data:
        folder.color = data['color']
    if 'icon' in data:
        folder.icon = data['icon']
        
    db.session.commit()
    return jsonify({'message': 'Folder updated'}), 200

@api_bp.route('/folders/<folder_id>', methods=['DELETE'])
@jwt_required()
def delete_folder(folder_id):
    current_user_id = int(get_jwt_identity())
    folder = Folder.query.filter_by(id=folder_id, user_id=current_user_id).first()
    
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    # Unlink notes from this folder before deleting
    Note.query.filter_by(folder_id=folder_id).update({'folder_id': None})
    
    db.session.delete(folder)
    db.session.commit()
    return jsonify({'message': 'Folder deleted'}), 200



@api_bp.route('/upload_file', methods=['POST'])
def upload_file():
    """Upload PDF or image files"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    filename = file.filename.lower()
    
    # Check for PDF
    if filename.endswith('.pdf'):
        try:
            file_stream = io.BytesIO(file.read())
            text = extract_text_from_pdf(file_stream)
            return jsonify({
                'text': text,
                'filename': file.filename,
                'type': 'pdf'
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # Check for images
    elif filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')):
        try:
            import base64
            file_content = file.read()
            base64_image = base64.b64encode(file_content).decode('utf-8')
            file_extension = filename.split('.')[-1]
            mime_type = f'image/{file_extension}'
            if file_extension == 'jpg':
                mime_type = 'image/jpeg'
            
            return jsonify({
                'image': f'data:{mime_type};base64,{base64_image}',
                'filename': file.filename,
                'type': 'image'
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Invalid file type. Only PDF and images (JPG, PNG, GIF, WEBP, BMP) allowed.'}), 400

@api_bp.route('/chat/decide', methods=['POST'])
@jwt_required()
def chat_decide():
    data = request.get_json()
    note_id = data.get('note_id')
    user_message = data.get('message')
    selected_text = data.get('selected_text')

    if not note_id or not user_message:
        return jsonify({'error': 'Missing note_id or message'}), 400

    note = Note.query.get(note_id)
    if not note:
        return jsonify({'error': 'Note not found'}), 404

    # Save user message
    user_chat_message = ChatMessage(note_id=note_id, sender='user', text=user_message)
    db.session.add(user_chat_message)
    db.session.commit()

    # Get attachment summaries
    attachments = Attachment.query.filter_by(note_id=note_id).all()
    attachment_summaries = []
    for att in attachments:
        file_path = os.path.join(UPLOAD_FOLDER, att.filepath)
        attachment_summaries.append({
            'id': att.id,
            'filename': att.filename,
            'filepath': file_path if os.path.exists(file_path) else None,
            'filetype': att.filetype,
            'summary': att.summary,
            'summary_status': att.summary_status
        })

    try:
        from services import decide_file_needs
        decision = decide_file_needs(user_message, note.content, attachment_summaries, selected_text)
        return jsonify(decision), 200
    except Exception as e:
        print(f"AI Decision Error: {e}")
        return jsonify({'error': str(e)}), 500

# --- Image Search Endpoint ---
from image_search import search_and_download_images

@api_bp.route('/search-images', methods=['POST'])
def search_images():
    try:
        data = request.get_json()
        query = data.get('query')
        limit = data.get('limit', 5)
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
            
        # Define save folder relative to backend
        base_dir = os.path.dirname(os.path.abspath(__file__))
        save_folder = os.path.join(base_dir, "downloaded_images")
        
        images = search_and_download_images(query, limit, save_folder)
        
        # Construct full URLs for the frontend
        # Assuming backend is running on localhost:5000
        base_url = request.host_url.rstrip('/')
        for img in images:
            img['url'] = f"{base_url}/api/downloaded_images/{img['filename']}"
            
        return jsonify({"images": images}), 200
        
    except Exception as e:
        print(f"Error in search_images: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/ai-replace-image', methods=['POST'])
def ai_replace_image():
    print("DEBUG: /ai-replace-image endpoint hit!")
    try:
        if 'file' not in request.files:
            print("DEBUG: No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            print("DEBUG: No selected file")
            return jsonify({'error': 'No selected file'}), 400

        print(f"DEBUG: Received file: {file.filename}")

        # Read file bytes
        image_bytes = file.read()
        mime_type = file.mimetype or mimetypes.guess_type(file.filename)[0] or 'image/jpeg'

        # 1. Analyze image with Gemini
        try:
            # Check for API Key
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                print("WARNING: GEMINI_API_KEY not found in environment variables.")
                # You might want to return an error or use a fallback if possible, 
                # but for now we'll proceed and let the client fail if it needs auth.
            
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    'Describe this image in a concise search query (max 5-7 words) to find similar images on the web. Return ONLY the search query.'
                ]
            )
            search_query = response.text.strip()
            print(f"Gemini generated search query: {search_query}")
            
        except Exception as e:
            print(f"Gemini Analysis Failed: {e}")
            return jsonify({'error': f"AI Analysis failed: {str(e)}"}), 500

        # 2. Search for images
        base_dir = os.path.dirname(os.path.abspath(__file__))
        save_folder = os.path.join(base_dir, "downloaded_images")
        
        # Use existing search function
        images = search_and_download_images(search_query, limit=6, save_folder=save_folder)
        
        # Construct URLs
        base_url = request.host_url.rstrip('/')
        for img in images:
            img['url'] = f"{base_url}/api/downloaded_images/{img['filename']}"
            
        return jsonify({
            "query": search_query,
            "images": images
        }), 200

    except Exception as e:
        print(f"Error in ai_replace_image: {e}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/downloaded_images/<path:filename>')
def serve_downloaded_image(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    directory = os.path.join(base_dir, "downloaded_images")
    return send_from_directory(directory, filename)

@api_bp.route('/chat/respond', methods=['POST'])
@jwt_required()
def chat_respond():
    data = request.get_json()
    note_id = data.get('note_id')
    user_message = data.get('message')
    selected_text = data.get('selected_text')
    mode = data.get('mode', 'think')
    file_numbers = data.get('file_numbers', []) # List of indices (1-based)

    if not note_id or not user_message:
        return jsonify({'error': 'Missing note_id or message'}), 400

    note = Note.query.get(note_id)
    if not note:
        return jsonify({'error': 'Note not found'}), 404

    # Get chat history (last 100 messages)
    history = ChatMessage.query.filter_by(note_id=note_id).order_by(ChatMessage.timestamp.desc()).limit(100).all()
    history = history[::-1] # Reverse to chronological order
    
    # Check if the user message was already saved (e.g. by /chat/decide)
    # We look at the last message from the user.
    last_user_msg = ChatMessage.query.filter_by(note_id=note_id, sender='user').order_by(ChatMessage.timestamp.desc()).first()
    
    if not last_user_msg or last_user_msg.text != user_message:
        # Save user message if it's missing or different
        user_chat_message = ChatMessage(note_id=note_id, sender='user', text=user_message)
        db.session.add(user_chat_message)
        db.session.commit()
        # Refresh history to include the new message
        history = ChatMessage.query.filter_by(note_id=note_id).order_by(ChatMessage.timestamp.asc()).all()

    chat_history = [{'sender': msg.sender, 'text': msg.text} for msg in history]

    # Build file attachments list with paths
    attachments = Attachment.query.filter_by(note_id=note_id).all()
    file_attachments = []
    analyzed_files = []

    try:
        for num in file_numbers:
            if 0 < num <= len(attachments):
                att = attachments[num - 1]
                file_path = os.path.join(UPLOAD_FOLDER, att.filepath)
                
                if os.path.exists(file_path):
                    analyzed_files.append(att.filename)
                    file_attachments.append({
                        'file_path': file_path,
                        'filetype': att.filetype,
                        'filename': att.filename
                    })

        from services import generate_ai_response
        response_data = generate_ai_response(
            user_message, 
            note.content, 
            mode, 
            chat_history, 
            file_attachments=file_attachments,
            selected_text=selected_text
        )
        
        response_text = response_data.get('response_text')
        updated_html = response_data.get('updated_html')
        requires_confirmation = response_data.get('requires_confirmation')

        # Save assistant response
        ai_chat_message = ChatMessage(note_id=note_id, sender='assistant', text=response_text)
        db.session.add(ai_chat_message)
        db.session.commit()

        return jsonify({
            'response_text': response_text,
            'updated_html': updated_html,
            'requires_confirmation': requires_confirmation,
            'analyzed_files': analyzed_files
        }), 200

    except Exception as e:
        print(f"AI Response Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/transcribe_audio', methods=['POST'])
@jwt_required()
def transcribe_audio():
    """Transcribe audio using Gemini AI"""
    current_user_id = int(get_jwt_identity())
    
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    audio_path = None
    try:
        # Create audio directory if not exists
        audio_dir = os.path.join(UPLOAD_FOLDER, 'audio')
        os.makedirs(audio_dir, exist_ok=True)
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}.webm"
        audio_path = os.path.join(audio_dir, unique_filename)
        
        # Save audio file
        print(f"DEBUG: Saving audio to {audio_path}")
        audio_file.save(audio_path)
        print(f"DEBUG: Audio saved successfully, size: {os.path.getsize(audio_path)} bytes")
        
        # Get transcription from AI service
        from services import transcribe_audio_with_ai
        print(f"DEBUG: Calling transcribe_audio_with_ai")
        transcription = transcribe_audio_with_ai(audio_path)
        print(f"DEBUG: Transcription received: {transcription[:50]}...")
        
        # Clean up audio file
        if os.path.exists(audio_path):
            os.unlink(audio_path)
            print(f"DEBUG: Audio file deleted")
        
        return jsonify({'transcription': transcription}), 200
    
    except Exception as e:
        print(f"ERROR: Transcription failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Clean up on error
        if audio_path and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except:
                pass
        
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500