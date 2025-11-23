import React from 'react';
import { motion } from 'framer-motion';

interface ResultDisplayProps {
    content: string;
    title: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ content, title }) => {
    if (!content) return null;

    return (
        <motion.div
            className="w-full h-full p-6 bg-dark-800 rounded-xl shadow-2xl border border-dark-700 overflow-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
        >
            <h2 className="text-2xl font-bold mb-4 text-gray-200">{title}</h2>
            <div
                className="prose prose-invert max-w-none ProseMirror"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        </motion.div>
    );
};

export default ResultDisplay;
