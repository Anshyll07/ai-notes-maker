import React, { useState } from 'react';

interface ImageSliderProps {
    images: {
        original_url: string;
        filename: string;
        local_path: string;
        url: string;
    }[];
}

const ImageSlider: React.FC<ImageSliderProps> = ({ images }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    if (!images || images.length === 0) return null;

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const openLightbox = (index: number) => {
        setCurrentIndex(index);
        setIsLightboxOpen(true);
    };

    // Bento Grid Layout for 3+ images
    if (images.length >= 3) {
        return (
            <div className="my-4">
                <div className="grid grid-cols-3 gap-2 aspect-video rounded-xl overflow-hidden bg-dark-800 border border-dark-600">
                    {/* Large Left Image (Span 2 cols) */}
                    <div className="col-span-2 relative h-full group overflow-hidden">
                        <img
                            src={images[0].url}
                            alt={images[0].filename}
                            className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                            onClick={() => openLightbox(0)}
                        />
                    </div>

                    {/* Right Column (Stacked) */}
                    <div className="col-span-1 flex flex-col gap-2 h-full">
                        <div className="relative flex-1 group overflow-hidden">
                            <img
                                src={images[1].url}
                                alt={images[1].filename}
                                className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                onClick={() => openLightbox(1)}
                            />
                        </div>
                        <div className="relative flex-1 group overflow-hidden">
                            <img
                                src={images[2].url}
                                alt={images[2].filename}
                                className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                onClick={() => openLightbox(2)}
                            />
                            {images.length > 3 && (
                                <div
                                    className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                                    onClick={() => openLightbox(3)}
                                >
                                    <span className="text-white font-medium text-lg">+{images.length - 3}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {renderLightbox()}
            </div>
        );
    }

    // Default Slider for < 3 images
    return (
        <div className="my-4">
            {/* Slider Container */}
            <div className="relative group rounded-xl overflow-hidden bg-dark-800 border border-dark-600 aspect-video">
                <img
                    src={images[currentIndex].url}
                    alt={`Result ${currentIndex + 1}`}
                    className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                    onClick={() => setIsLightboxOpen(true)}
                />

                {/* Navigation Buttons */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <span className="material-icons">chevron_left</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <span className="material-icons">chevron_right</span>
                        </button>
                    </>
                )}

                {/* Indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-white' : 'bg-white/50'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {renderLightbox()}
        </div>
    );

    function renderLightbox() {
        if (!isLightboxOpen) return null;
        return (
            <div
                className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                onClick={() => setIsLightboxOpen(false)}
            >
                <button
                    className="absolute top-4 right-4 text-white hover:text-gray-300 z-[101]"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    <span className="material-icons text-4xl">close</span>
                </button>

                <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 z-[101]"
                    onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                >
                    <span className="material-icons text-5xl">chevron_left</span>
                </button>

                <img
                    src={images[currentIndex].url}
                    alt={`Result ${currentIndex + 1}`}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />

                <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 z-[101]"
                    onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                >
                    <span className="material-icons text-5xl">chevron_right</span>
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 font-mono text-sm">
                    {currentIndex + 1} / {images.length}
                </div>
            </div>
        );
    }
};

export default ImageSlider;
