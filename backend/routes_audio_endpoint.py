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
    
    try:
        # Save the audio file temporarily
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name
        
        # Get transcription from AI service
        from services import transcribe_audio_with_ai
        transcription = transcribe_audio_with_ai(temp_path)
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return jsonify({'transcription': transcription}), 200
    
    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify({'error': str(e)}), 500
