import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, HelpCircle, ArrowRight, Sigma, MessageSquare } from 'lucide-react';

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
        { label: 'Summarize', action: 'Summarize this: ', icon: <FileText size={14} /> },
        { label: 'Explain', action: 'Explain this: ', icon: <HelpCircle size={14} /> },
        { label: 'Improve', action: 'Improve the writing of: ', icon: <Sparkles size={14} /> },
        { label: 'Continue', action: 'Continue writing after: ', icon: <ArrowRight size={14} /> },
        { label: 'Make Equation', action: 'Convert this text to a LaTeX equation (wrapped in $): ', icon: <Sigma size={14} /> },
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
            className="fixed bg-dark-800 border border-dark-700 shadow-xl rounded-lg p-1 z-50 w-48"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
        >
            {!showInput ? (
                <div className="flex flex-col gap-0.5">
                    {quickActions.map((action) => (
                        <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.action)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left w-full"
                        >
                            <span className="text-gray-400">{action.icon}</span>
                            <span>{action.label}</span>
                        </button>
                    ))}

                    <div className="h-px bg-dark-700 my-0.5" />

                    <button
                        onClick={() => setShowInput(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded transition-colors text-left w-full"
                    >
                        <MessageSquare size={14} />
                        <span>Ask anything...</span>
                    </button>
                </div>
            ) : (
                <div className="p-1 space-y-2">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCustomAsk()}
                        placeholder="Ask AI..."
                        className="w-full px-2 py-1.5 bg-dark-900 border border-dark-700 text-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                        autoFocus
                    />
                    <div className="flex gap-1">
                        <button
                            onClick={handleCustomAsk}
                            className="flex-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        >
                            Ask
                        </button>
                        <button
                            onClick={() => setShowInput(false)}
                            className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-gray-400 transition-colors"
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
