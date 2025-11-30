import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
    onTranscriptionComplete: (text: string) => void;
    onClose: () => void;
}

type RecordingSource = 'microphone' | 'system';

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptionComplete, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [selectedSource, setSelectedSource] = useState<RecordingSource | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const [pendingSource, setPendingSource] = useState<RecordingSource | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const requestPermissionAndStart = async (source: RecordingSource) => {
        try {
            let stream: MediaStream;
            let displayStream: MediaStream | null = null;

            if (source === 'microphone') {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } else {
                displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
                    video: true,
                    audio: true,
                });

                const audioTracks = displayStream!.getAudioTracks();
                if (audioTracks.length === 0) {
                    displayStream!.getTracks().forEach(track => track.stop());
                    throw new Error('No audio track available. Please make sure to check "Share audio" or "Share tab audio" when selecting your screen!');
                }

                stream = new MediaStream(audioTracks);
            }

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await uploadAndTranscribe(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
                if (displayStream) {
                    displayStream.getTracks().forEach((track) => track.stop());
                }
            };

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;

            if (displayStream) {
                displayStream.getVideoTracks().forEach((track: MediaStreamTrack) => track.stop());
            }

            setIsRecording(true);
            setSelectedSource(source);
            setShowPermissionDialog(false);
            setPendingSource(null);

            timerRef.current = window.setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
            setPendingSource(null);
            alert('Failed to start recording: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const startRecording = async (source: RecordingSource) => {
        setShowPermissionDialog(true);
        setPendingSource(source);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const uploadAndTranscribe = async (audioBlob: Blob) => {
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) throw new Error('Please log in to use voice transcription');

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await fetch('http://localhost:5000/api/transcribe_audio', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Transcription failed');
            }

            const data = await response.json();
            onTranscriptionComplete(data.transcription);
            onClose();
        } catch (error) {
            console.error('Error transcribing audio:', error);
            alert(error instanceof Error ? error.message : 'Failed to transcribe audio. Please try again.');
        } finally {
            setIsProcessing(false);
            setRecordingTime(0);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] rounded-xl p-6 w-96 border border-gray-700 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Voice Recording</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {showPermissionDialog ? (
                    <div className="space-y-4"><div className="text-center py-4">
                        <svg className="w-16 h-16 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        <h4 className="text-lg font-semibold text-white mb-2">Permission Required</h4>
                        <p className="text-gray-400 mb-6">Do you want to allow {pendingSource === 'microphone' ? 'microphone' : 'system audio'} access?</p>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPermissionDialog(false); setPendingSource(null); }} className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors font-semibold">No, Cancel</button>
                            <button onClick={() => { if (pendingSource) { setShowPermissionDialog(false); setTimeout(() => requestPermissionAndStart(pendingSource), 100); } }} className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all font-semibold">Yes, Allow</button>
                        </div>
                    </div></div>
                ) : !isRecording && !isProcessing ? (
                    <div className="space-y-4">
                        <p className="text-gray-400 text-sm mb-4">Choose audio source:</p>
                        <button onClick={() => startRecording('microphone')} className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            <span className="font-semibold">Record from Microphone</span>
                        </button>
                        <button onClick={() => startRecording('system')} className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-4 px-6 rounded-lg hover:from-green-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center space-x-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                            <span className="font-semibold">Record System Audio</span>
                        </button>
                    </div>
                ) : isRecording ? (
                    <div className="text-center space-y-6">
                        <div className="flex justify-center"><div className="relative">
                            <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
                            </div>
                            <div className="absolute inset-0 w-24 h-24 bg-red-500 rounded-full animate-ping opacity-75"></div>
                        </div></div>
                        <div className="text-4xl font-mono font-bold text-white">{formatTime(recordingTime)}</div>
                        <p className="text-gray-400">Recording from {selectedSource === 'microphone' ? 'Microphone' : 'System Audio'}</p>
                        <button onClick={stopRecording} className="w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-semibold">Stop Recording</button>
                    </div>
                ) : (
                    <div className="text-center space-y-4 py-8">
                        <div className="flex justify-center"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                        <p className="text-white font-semibold">Transcribing audio...</p>
                        <p className="text-gray-400 text-sm">This may take a moment</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceRecorder;
