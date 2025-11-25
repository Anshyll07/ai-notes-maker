from flask import Blueprint, request, jsonify, send_from_directory
from services import chat_with_ai, extract_text_from_pdf
from models import db, User, Note, ChatMessage, Folder, Attachment
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
import io
import uuid
import os
from werkzeug.utils import secure_filename

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
                'url': f'/api/attachments/{attachment.filepath}'
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
            print(f"DEBUG: Deleted file {filepath}")
        
        # Remove summary file if exists
        summary_path = filepath + '.json'
        if os.path.exists(summary_path):
            os.remove(summary_path)
            print(f"DEBUG: Deleted summary {summary_path}")
            
    except Exception as e:
        print(f"Error deleting file {attachment.filepath}: {e}")

@api_bp.route('/notes/<note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    current_user_id = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()
    
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    
    # Delete attachment files from disk
    for attachment in note.attachments:
        cleanup_attachment_files(attachment)
        
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Note deleted'}), 200

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

        new_attachment = Attachment(
            note_id=note_id,
            filename=original_filename,
            filepath=unique_filename, # Store just the unique filename for URL construction
            filetype=filetype
        )
        db.session.add(new_attachment)
        db.session.commit()
        
        # Generate summary for PDF
        if filetype == 'pdf':
            try:
                from services import summarize_pdf
                summary = summarize_pdf(filepath)
                
                # Save summary to sidecar JSON file
                summary_path = filepath + '.json'
                with open(summary_path, 'w') as f:
                    json.dump({'summary': summary}, f)
            except Exception as e:
                print(f"Error generating summary: {e}")

        return jsonify({
            'id': new_attachment.id,
            'filename': new_attachment.filename,
            'filetype': new_attachment.filetype,
            'url': f'/api/attachments/{new_attachment.filepath}' # URL to serve the file
        }), 201
    else:
        return jsonify({'error': 'Allowed file types are png, jpg, jpeg, gif, pdf'}), 400

@api_bp.route('/attachments/<filename>', methods=['GET'])
def serve_attachment(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

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

@api_bp.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    """Legacy endpoint for PDF uploads"""
    return upload_file()

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

@api_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    current_user_id = int(get_jwt_identity())
    data = request.json
    note_id = data.get('note_id')
    user_message = data.get('message')
    current_content = data.get('content')
    mode = data.get('mode', 'always')
    pdf_context_filename = data.get('pdf_context')

    if not note_id or not user_message:
        return jsonify({'error': 'Note ID and message required'}), 400

    # Verify note ownership
    note = Note.query.filter_by(id=note_id, user_id=current_user_id).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404

    # Save user message
    user_chat_message = ChatMessage(note_id=note_id, sender='user', text=user_message)
    db.session.add(user_chat_message)
    db.session.commit()

    # Handle PDF Context
    pdf_context_path = None
    if pdf_context_filename:
        # Find the attachment
        attachment = Attachment.query.filter_by(note_id=note_id, filename=pdf_context_filename).first()

        if attachment and attachment.filetype == 'pdf':
            file_path = os.path.join(UPLOAD_FOLDER, attachment.filepath)
            if os.path.exists(file_path):
                pdf_context_path = file_path
    
    # Get PDF context if provided (for legacy/direct support)
    # This overrides the attachment-based pdf_context_path if pdf_filename is provided via args
    pdf_filename = request.args.get('pdf_filename')
    
    if pdf_filename:
        # Security check: ensure filename is in uploads
        # We assume pdf_filename is just the basename
        pdf_context_path = os.path.join(UPLOAD_FOLDER, secure_filename(pdf_filename))
        if not os.path.exists(pdf_context_path):
            pdf_context_path = None

    # Get chat history
    history = ChatMessage.query.filter_by(note_id=note_id).order_by(ChatMessage.timestamp.asc()).all()
    chat_history = [{'sender': msg.sender, 'text': msg.text} for msg in history]

    # Get selected text
    selected_text = data.get('selected_text')

    # Call AI Service
    try:
        response_data = chat_with_ai(
            user_message, 
            current_content, 
            mode,
            chat_history=chat_history[:-1], # Exclude the current message as it's passed as 'message'
            pdf_context_path=pdf_context_path,
            selected_text=selected_text,
            pdf_filename=pdf_filename # Pass the potentially new pdf_filename
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
            'requires_confirmation': requires_confirmation
        }), 200

    except Exception as e:
        print(f"AI Error: {e}")
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