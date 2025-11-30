import React, { useState, useRef, useEffect } from 'react';
import VoiceRecorder from './VoiceRecorder';
import ImageSlider from './ImageSlider';

type ConfirmationMode = 'always' | 'never' | 'think';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  images?: {
    original_url: string;
    filename: string;
    local_path: string;
    url: string;
  }[];
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
  onClearChat: () => void;
  isLoading: boolean;
  loadingMessage?: string;
  mode: ConfirmationMode;
  onModeChange: (mode: ConfirmationMode) => void;
  attachments: Attachment[];
  isAutoFileAccessEnabled: boolean;
  onToggleAutoFileAccess: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  isLoading,
  loadingMessage = 'Thinking...',
  mode,
  onModeChange,
  attachments = [],
  isAutoFileAccessEnabled,
  onToggleAutoFileAccess
}) => {

  const [input, setInput] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, loadingMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }

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
      // Trigger resize after update
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const filteredAttachments = attachments.filter(att =>
    att.filename.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      let pdfContext = undefined;

      // Find mentioned attachments
      const mentionedAttachment = attachments.find(att => input.includes(`@${att.filename}`));
      if (mentionedAttachment) {
        pdfContext = mentionedAttachment.filename;

      } else {
        // If no explicit mention, check if there are attachments
        // Automatically use the most recent attachment (last in the list)
        if (attachments.length > 0 && isAutoFileAccessEnabled) {
          // Only auto-select if enabled
          // But wait, the parent handles the auto-decision logic now.
          // So here we just pass undefined if no explicit mention.
          // The parent will decide whether to call /decide or not.
          // But for the loading status, we should be careful.

        } else {

        }
      }

      onSendMessage(input, pdfContext);
      setInput('');
      setShowMentionPopup(false);

      // Reset height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-800 border-l border-dark-700 overflow-y-hidden">
      <div className="p-4 border-b border-dark-700 bg-dark-900/50 backdrop-blur-sm flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <span className="material-icons text-blue-400 text-sm">smart_toy</span>
          Lumina Copilot
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAutoFileAccess}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isAutoFileAccessEnabled
              ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            title={isAutoFileAccessEnabled ? "Auto-analyze files enabled" : "Auto-analyze files disabled"}
          >
            <span className="material-icons text-[14px]">
              {isAutoFileAccessEnabled ? 'auto_awesome' : 'do_not_disturb_on'}
            </span>
            {isAutoFileAccessEnabled ? 'Auto' : 'Manual'}
          </button>
          <button
            onClick={onClearChat}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
            title="Delete Chat"
          >
            <span className="material-icons text-sm">delete_outline</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pr-2">
        <div className="flex flex-col gap-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-xl ${msg.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-700 text-gray-300'
                  }`}
              >
                {msg.sender === 'assistant' ? (
                  <>
                    <div
                      className="text-sm prose prose-invert prose-sm max-w-none ai-message-content 
                      [&>h1]:text-2xl [&>h1]:font-normal [&>h1]:mb-4 
                      [&>h2]:text-xl [&>h2]:font-normal [&>h2]:mt-4 [&>h2]:mb-2 
                      [&>h3]:text-lg [&>h3]:font-normal [&>h3]:mt-3 [&>h3]:mb-1 
                      [&>ul]:list-disc [&>ul]:pl-4 [&>li]:mb-1"
                      dangerouslySetInnerHTML={{ __html: msg.text }}
                    />
                    {msg.images && msg.images.length > 0 && (
                      <ImageSlider images={msg.images} />
                    )}
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-1">
              <div className="max-w-[85%] p-3 rounded-xl bg-dark-700 text-gray-300">
                <p className="text-sm animate-pulse">{loadingMessage}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="mt-4 flex-shrink-0 space-y-3 relative p-4 pt-0">
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
          <div className="relative flex items-end gap-2 bg-dark-700 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask the AI... (@ to mention)"
              disabled={isLoading}
              rows={2}
              className="w-full bg-transparent text-gray-300 focus:outline-none resize-none max-h-32 py-2 px-1 text-sm scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent"
              style={{ minHeight: '3rem' }}
            />

            <div className="flex flex-col gap-2 pb-1">
              {/* Voice Recorder Button */}
              <button
                type="button"
                onClick={() => setShowVoiceRecorder(true)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-purple-400 hover:bg-dark-600 transition-all"
                title="Record audio"
              >
                <span className="material-icons text-xl">mic</span>
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <VoiceRecorder
            onTranscriptionComplete={(text) => {
              setInput(prev => prev + ' ' + text);
              setShowVoiceRecorder(false);
            }}
            onClose={() => setShowVoiceRecorder(false)}
          />
        </div>
      )}
    </div>
  );
};

export default ChatPanel;