import { useState } from 'react';
import { motion } from 'framer-motion';

interface AIBubbleProps {
    position: { x: number; y: number };
    selectedText: string;
    onAsk: (question: string) => void;
    onClose: () => void;
}

const AIBubble: React.FC<AIBubbleProps> = ({ position, selectedText, onAsk, onClose }) => {
    const [question, setQuestion] = useState('');
    const [showInput, setShowInput] = useState(false);

    const quickActions = [
        { label: 'Summarize', action: 'Summarize this: ' },
        { label: 'Explain', action: 'Explain this: ' },
        { label: 'Improve', action: 'Improve the writing of: ' },
        { label: 'Continue', action: 'Continue writing after: ' },
    ];

    const handleQuickAction = (actionPrompt: string) => {
        onAsk(actionPrompt + selectedText);
    };

    const handleCustomAsk = () => {
        if (question.trim()) {
            onAsk(question + '\n\nContext: ' + selectedText);
            setQuestion('');
        }
    };

    return (
        <motion.div
            className="fixed bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-3 z-50 min-w-[300px]"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold">Ask AI</span>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>

            {!showInput ? (
                <div className="space-y-1">
                    {quickActions.map((action) => (
                        <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.action)}
                            className="w-full text-left px-3 py-2 text-sm rounded-md bg-dark-700 hover:bg-blue-600 text-gray-200 transition-colors"
                        >
                            {action.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowInput(true)}
                        className="w-full text-left px-3 py-2 text-sm rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                    >
                        Ask anything...
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCustomAsk()}
                        placeholder="Type your question..."
                        className="w-full px-3 py-2 bg-dark-900 text-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleCustomAsk}
                            className="flex-1 px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        >
                            Ask
                        </button>
                        <button
                            onClick={() => setShowInput(false)}
                            className="px-3 py-1.5 text-sm rounded-md bg-dark-700 hover:bg-dark-600 text-gray-300 transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default AIBubble;
