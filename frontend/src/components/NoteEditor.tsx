import React, { useRef, MouseEvent, useState } from 'react';
import { motion } from 'framer-motion';

interface NoteEditorProps {
    noteId: string | undefined;
    value: string;
    onChange: (value: string) => void;
    attachments: any[];
    onFileUpload: (file: File, noteId:string) => void;
    onAttachmentClick: (attachment: any) => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ noteId, value, onChange, attachments, onFileUpload, onAttachmentClick }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [zoom, setZoom] = useState(1);

    const handleFileButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault(); // Prevent form submission
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            if (noteId) {
                onFileUpload(file, noteId);
            }
            event.target.value = ''; // Clear the input after selection
        }
    };

    const handleZoomIn = () => {
        setZoom(prevZoom => prevZoom * 1.1);
    };

    const handleZoomOut = () => {
        setZoom(prevZoom => prevZoom / 1.1);
    };

    return (
        <motion.div
            className="w-full h-full p-6 bg-dark-800 rounded-xl shadow-2xl border border-dark-700 card-3d"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Your Notes</h2>
            <div className="flex items-center mb-4">
                <button
                    onClick={handleFileButtonClick}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 mr-2"
                >
                    Attach File
                </button>
                            <textarea
                className="w-full h-[calc(100%-10rem)] bg-dark-900 text-gray-300 p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                placeholder="Start typing your notes here..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ fontSize: `${1 * zoom}rem` }}
            />
            <div className="flex items-center justify-center mt-2">
                <button
                    onClick={handleZoomOut}
                    className="px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 mr-2"
                    aria-label="Zoom out"
                >
                    -
                </button>
                <span className="text-gray-300">{Math.round(zoom * 100)}%</span>
                <button
                    onClick={handleZoomIn}
                    className="px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 ml-2"
                    aria-label="Zoom in"
                >
                    +
                </button>
            </div>
            {/* Attachments display area will go here */}
        </motion.div>
    );
};

export default NoteEditor;