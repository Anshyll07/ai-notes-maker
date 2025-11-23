import { motion } from 'framer-motion';

interface AIResponseModalProps {
    response: string;
    onAccept: () => void;
    onReject: () => void;
}

const AIResponseModal: React.FC<AIResponseModalProps> = ({ response, onAccept, onReject }) => {
    return (
        <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="bg-dark-800 rounded-xl shadow-2xl border border-dark-600 max-w-2xl w-full max-h-[80vh] overflow-hidden"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
            >
                <div className="p-6 border-b border-dark-700 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-200">AI Response</h3>
                    <button
                        onClick={onReject}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 overflow-auto max-h-[50vh]">
                    <div
                        className="prose prose-invert max-w-none ProseMirror"
                        dangerouslySetInnerHTML={{ __html: response }}
                    />
                </div>

                <div className="p-6 border-t border-dark-700 flex gap-3 justify-end">
                    <button
                        onClick={onReject}
                        className="px-6 py-2.5 rounded-lg font-semibold text-gray-300 bg-dark-700 hover:bg-dark-600 transition-colors"
                    >
                        Reject
                    </button>
                    <button
                        onClick={onAccept}
                        className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-colors"
                    >
                        Accept & Insert
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default AIResponseModal;
