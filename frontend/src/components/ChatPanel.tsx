import React, { useState, useRef, useEffect } from 'react';

type ConfirmationMode = 'always' | 'never' | 'think';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

interface Attachment {
  id: number;
  filename: string;
  filetype: string;
  url: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string, pdfContext?: string) => void;
  isLoading: boolean;
  mode: ConfirmationMode;
  onModeChange: (mode: ConfirmationMode) => void;
  attachments?: Attachment[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isLoading, mode, onModeChange, attachments = [] }) => {
  const [input, setInput] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Check for @ mention
    const lastAtPos = newValue.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const textAfterAt = newValue.slice(lastAtPos + 1);
      // Only show if there's no space after @ (simple check)
      if (!textAfterAt.includes(' ')) {
        setShowMentionPopup(true);
        setMentionQuery(textAfterAt);
        return;
      }
    }
    setShowMentionPopup(false);
  };

  const handleMentionSelect = (attachment: Attachment) => {
    const lastAtPos = input.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const newValue = input.slice(0, lastAtPos) + `@${attachment.filename} ` + input.slice(lastAtPos + mentionQuery.length + 1);
      setInput(newValue);
      setShowMentionPopup(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      // Check if the message contains an attachment mention that matches one of our attachments
      // This is a simple check. For more robust handling, we might want to store the selected attachment ID.
      // For now, we'll extract the filename from the text if it matches @filename
      let pdfContext = undefined;

      // Find mentioned attachments
      const mentionedAttachment = attachments.find(att => input.includes(`@${att.filename}`));
      if (mentionedAttachment && mentionedAttachment.filetype === 'pdf') {
        // We'll pass the filename or ID to the parent, which will handle fetching the content
        // Or we can pass a special flag. 
        // The prompt said "pass the selected attachment's context".
        // Let's pass the filename for now, and the backend can look it up or we fetch it here?
        // The plan said "Update Backend to parse mentions".
        // But we also have `pdfContext` argument in `onSendMessage`.
        // Let's pass the filename as pdfContext for now, or let the parent handle it.
        // Actually, the backend needs to know WHICH file to read.
        // Let's pass the filename in the message or as a separate argument.
        // The current signature is `onSendMessage(message, pdfContext)`.
        // Let's pass the filename as `pdfContext`.
        pdfContext = mentionedAttachment.filename;
      }

      onSendMessage(input, pdfContext);
      setInput('');
      setShowMentionPopup(false);
    }
  };

  const filteredAttachments = attachments.filter(att =>
    att.filename.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-dark-800 border-l border-dark-700 p-4 flex flex-col relative">
      <h2 className="text-lg font-bold text-gray-200 mb-4 flex-shrink-0">AI Assistant</h2>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="flex flex-col gap-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-xl ${msg.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-700 text-gray-300'
                  }`}
              >
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-1">
              <div className="max-w-[85%] p-3 rounded-xl bg-dark-700 text-gray-300">
                <p className="text-sm animate-pulse">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="mt-4 flex-shrink-0 space-y-3 relative">
        {/* Mention Popup */}
        {showMentionPopup && filteredAttachments.length > 0 && (
          <div className="absolute bottom-full left-0 w-full mb-2 bg-dark-800 border border-dark-600 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="p-2 border-b border-dark-700 text-xs text-gray-400">
              Mention an attachment
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredAttachments.map(att => (
                <button
                  key={att.id}
                  onClick={() => handleMentionSelect(att)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-dark-700 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-gray-400">
                    {att.filetype === 'pdf' ? 'picture_as_pdf' : 'image'}
                  </span>
                  <span className="truncate">{att.filename}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation Mode Dropdown */}
        <div>
          <label htmlFor="mode-select" className="text-xs text-gray-400 mb-1 block">AI Behavior</label>
          <select
            id="mode-select"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as ConfirmationMode)}
            className="w-full p-2 text-sm rounded-md bg-dark-700 text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500 border border-dark-600"
          >
            <option value="always">Always Apply Changes</option>
            <option value="never">Never Apply Changes</option>
            <option value="think">Let AI Decide When to Ask</option>
          </select>
        </div>

        {/* Chat Input Form */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask the AI to edit your notes... (Type @ to mention attachment)"
              disabled={isLoading}
              className="w-full p-3 pr-12 rounded-lg bg-dark-700 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;