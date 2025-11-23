import React from 'react';
import { motion } from 'framer-motion';

interface AIControlsProps {
    onSummarize: () => void;
    onBeautify: () => void;
    onShorten: () => void;
    isLoading: boolean;
}

const AIControls: React.FC<AIControlsProps> = ({ onSummarize, onBeautify, onShorten, isLoading }) => {
    const buttons = [
        { label: 'Summarize', action: onSummarize, color: 'bg-blue-600 hover:bg-blue-500' },
        { label: 'Beautify', action: onBeautify, color: 'bg-purple-600 hover:bg-purple-500' },
        { label: 'Shorten', action: onShorten, color: 'bg-green-600 hover:bg-green-500' },
    ];

    return (
        <div className="flex flex-col gap-4 p-4">
            {buttons.map((btn, index) => (
                <motion.button
                    key={btn.label}
                    className={`py-3 px-6 rounded-lg font-semibold text-white shadow-lg transform transition-all duration-200 ${btn.color} disabled:opacity-50 disabled:cursor-not-allowed`}
                    whileHover={{ scale: 1.05, translateZ: 10 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={btn.action}
                    disabled={isLoading}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                >
                    {isLoading ? 'Processing...' : btn.label}
                </motion.button>
            ))}
        </div>
    );
};

export default AIControls;
