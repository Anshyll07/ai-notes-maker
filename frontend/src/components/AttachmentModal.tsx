import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface Attachment {
    id: number;
    filename: string;
    filetype: string;
    url: string;
}

interface AttachmentModalProps {
    attachment: Attachment | null;
    baseUrl: string;
    onClose: () => void;
}

const AttachmentModal: React.FC<AttachmentModalProps> = ({ attachment, baseUrl, onClose }) => {
    const [numPages, setNumPages] = React.useState<number | null>(null);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setErrorMessage(null);
    };

    const onDocumentLoadError = (error: Error) => {
        console.error('Error loading PDF:', error);
        setErrorMessage(error.message);
    };

    if (!attachment) {
        return null;
    }

    const attachmentUrl = baseUrl + attachment.url;

    return (
        <AnimatePresence>
            {attachment && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-dark-900 bg-opacity-80 flex justify-center items-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative bg-dark-800 rounded-lg shadow-xl max-w-4xl w-full h-full max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-dark-700">
                            <h3 className="text-lg font-semibold text-gray-200 truncate">{attachment.filename}</h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors"
                                title="Close"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4 flex justify-center">
                            {attachment.filetype === 'image' && (
                                <img src={attachmentUrl} alt={attachment.filename} className="max-w-full max-h-full object-contain" />
                            )}
                            {attachment.filetype === 'pdf' && (
                                <div className="flex flex-col items-center w-full h-full">
                                    <Document
                                        file={attachmentUrl}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        onLoadError={onDocumentLoadError}
                                        className="flex flex-col items-center gap-4"
                                        error={
                                            <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2">
                                                <span className="material-symbols-outlined text-4xl">error</span>
                                                <p>Failed to load PDF file.</p>
                                                {errorMessage && (
                                                    <p className="text-xs text-gray-500 max-w-md text-center">
                                                        Error: {errorMessage}
                                                    </p>
                                                )}
                                                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
                                                    Open in new tab
                                                </a>
                                            </div>
                                        }
                                    >
                                        {Array.from(new Array(numPages), (el, index) => (
                                            <Page
                                                key={`page_${index + 1}`}
                                                pageNumber={index + 1}
                                                renderTextLayer={true}
                                                renderAnnotationLayer={true}
                                            />
                                        ))}
                                    </Document>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AttachmentModal;
