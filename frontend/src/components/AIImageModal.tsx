import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Search, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (imageUrl: string) => Promise<void>;
    sourceImageSrc: string | null;
}

export default function AIImageModal({ isOpen, onClose, onGenerate, sourceImageSrc }: AIImageModalProps) {
    const [step, setStep] = useState<'analyzing' | 'searching' | 'results'>('analyzing');
    const [results, setResults] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isReplacing, setIsReplacing] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('analyzing');
            setResults([]);
            setSelectedImage(null);
            setIsReplacing(false);
            startAnalysis();
        }
    }, [isOpen]);

    const cleanupImages = async (urlsToDelete: string[]) => {
        if (urlsToDelete.length === 0) return;
        try {
            await fetch('http://localhost:5000/api/cleanup-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: urlsToDelete }),
            });
        } catch (error) {
            console.error("Cleanup failed:", error);
        }
    };

    const startAnalysis = async () => {
        console.log("Starting analysis, source:", sourceImageSrc);
        if (!sourceImageSrc) {
            console.error("No source image source provided");
            return;
        }

        try {
            // Step 1: Analyzing
            setStep('analyzing');

            // Convert sourceImageSrc to Blob/File
            let fileToUpload: Blob;
            console.log("Fetching image blob...");
            if (sourceImageSrc.startsWith('data:')) {
                const res = await fetch(sourceImageSrc);
                fileToUpload = await res.blob();
            } else {
                // If it's a URL (backend served), fetch it
                const res = await fetch(sourceImageSrc);
                fileToUpload = await res.blob();
            }
            console.log("Image blob fetched, size:", fileToUpload.size);

            const formData = new FormData();
            formData.append('file', fileToUpload, 'image.jpg');

            // Step 2: Searching (Call API)
            setStep('searching');

            console.log("Sending request to backend...");
            const response = await fetch('http://localhost:5000/api/ai-replace-image', {
                method: 'POST',
                body: formData,
            });
            console.log("Response received, status:", response.status);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Analysis failed: ${response.status} ${errText}`);
            }

            const data = await response.json();
            console.log("Data received:", data);

            // Extract URLs from response
            const imageUrls = data.images.map((img: any) => img.url);
            setResults(imageUrls);
            setStep('results');

        } catch (error) {
            console.error("AI Replace Error:", error);
            // Handle error (maybe show error state)
            setStep('results'); // Fallback or show error
        }
    };

    // Handle closing (cancel)
    const handleClose = () => {
        // If we have results but didn't select/replace, clean them ALL up
        if (step === 'results' && results.length > 0 && !isReplacing) {
            cleanupImages(results);
        }
        onClose();
    };

    const handleConfirm = async () => {
        if (!selectedImage) return;

        setIsReplacing(true);
        try {
            await onGenerate(selectedImage);

            // Cleanup UNSELECTED images
            const unselected = results.filter(url => url !== selectedImage);

            // ALSO cleanup the ORIGINAL image if it was an AI downloaded image
            if (sourceImageSrc && sourceImageSrc.includes('/api/downloaded_images/')) {
                unselected.push(sourceImageSrc);
            }

            cleanupImages(unselected);

            onClose();
        } catch (error) {
            console.error("Replacement failed", error);
        } finally {
            setIsReplacing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-dark-900 rounded-xl overflow-hidden shadow-2xl flex flex-col border border-dark-700 h-[600px]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Sparkles size={18} className="text-purple-500" />
                        AI Find Similar
                    </h3>
                    <button onClick={handleClose} className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {step === 'analyzing' && (
                            <motion.div
                                key="analyzing"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center gap-4 text-center"
                            >
                                <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                                    {sourceImageSrc ? (
                                        <img src={sourceImageSrc} alt="Source" className="w-full h-full object-cover opacity-50" />
                                    ) : (
                                        <div className="w-full h-full bg-dark-800 flex items-center justify-center">
                                            <ImageIcon size={32} className="text-gray-600" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent animate-scan" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-medium text-white mb-1">Analyzing Image...</h4>
                                    <p className="text-gray-400 text-sm">Identifying subjects, colors, and composition</p>
                                </div>
                            </motion.div>
                        )}

                        {step === 'searching' && (
                            <motion.div
                                key="searching"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center gap-4 text-center"
                            >
                                <div className="p-4 rounded-full bg-dark-800 border border-dark-700">
                                    <Search size={32} className="text-blue-400 animate-pulse" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-medium text-white mb-1">Searching Web...</h4>
                                    <p className="text-gray-400 text-sm">Finding visually similar high-quality images</p>
                                </div>
                            </motion.div>
                        )}

                        {step === 'results' && (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="w-full h-full flex flex-col"
                            >
                                <h4 className="text-sm font-medium text-gray-400 mb-4">Select an image to replace:</h4>
                                <div className="flex-1 grid grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                                    {results.map((src, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedImage(src)}
                                            className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedImage === src
                                                    ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                                                    : 'border-transparent hover:border-gray-600'
                                                }`}
                                        >
                                            <img src={src} alt={`Result ${i}`} className="w-full h-full object-cover" />
                                            {selectedImage === src && (
                                                <div className="absolute top-2 right-2 bg-purple-500 text-white p-1 rounded-full shadow-lg">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-4 bg-dark-800 border-t border-dark-700 flex justify-end gap-2">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-dark-700 rounded-lg transition-colors"
                        disabled={isReplacing}
                    >
                        Cancel
                    </button>
                    {step === 'results' && (
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedImage || isReplacing}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isReplacing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Replacing...
                                </>
                            ) : (
                                <>
                                    Replace Image
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
