# Voice Transcription Feature

## Overview
Added voice transcription functionality with two recording options:
1. **Microphone Recording** - Record from your microphone
2. **System Audio Recording** - Record computer audio/system sound

## Features Added

### Frontend Components

1. **VoiceRecorder.tsx** - Complete voice recording modal
   - Beautiful UI with animated recording indicator
   - Timer display during recording
   - Two recording modes (mic/system audio)
   - Automatic transcription upload

2. **ChatPanel.tsx** - Integration
   - Voice recorder button next to send button (purple/pink gradient)
   - Opens modal when clicked
   - Transcribed text appears in input field

### Backend Endpoints

1. **`/api/transcribe_audio`** - New endpoint
   - Accepts audio file upload (WebM format)
   - Uses Gemini AI for transcription
   - Returns transcribed text

2. **`transcribe_audio_with_ai()`** - Service function
   - Uses `client.files.upload()` for audio upload
   - Sends to Gemini 2.5 Flash for transcription
   - Returns clean transcribed text

## How It Works

1. **User clicks microphone button** in chat input
2. **Modal opens** asking for audio source choice
3. **User selects** Microphone or System Audio
4. **Recording starts** with visual feedback (pulsing red circle + timer)
5. **User clicks stop** when done
6. **Audio is uploaded** to backend
7. **Gemini AI transcribes** the audio
8. **Transcribed text appears** in chat input
9. **User can edit** and send as normal message

## Technical Details

- **Audio Format**: WebM (browser standard)
- **AI Model**: Gemini 2.5 Flash Preview
- **Temp File Handling**: Automatic cleanup after transcription
- **Authentication**: JWT required for API access

## Usage

1. Click the **microphone button** (purple/pink) next to send button
2. Choose **"Record from Microphone"** or **"Record System Audio"**
3. Speak or play audio
4. Click **"Stop Recording"** when done
5. Wait for transcription (shows loading spinner)
6. Edit the transcribed text if needed
7. Send to AI assistant

## Browser Permissions

- **Microphone**: Requires microphone permission
- **System Audio**: Requires screen sharing permission (to capture audio)

## Error Handling

- Permission denied → Alert shown
- Transcription failed → Alert with retry option
- Network errors → Graceful error messages

Enjoy your new voice transcription feature! 🎤
