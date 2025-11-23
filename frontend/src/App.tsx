import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import RichTextEditor from './components/RichTextEditor';
import ChatPanel from './components/ChatPanel';
import AIBubble from './components/AIBubble';
import AIResponseModal from './components/AIResponseModal';
import AttachmentModal from './components/AttachmentModal';
import { NotesBar } from './components/NotesBar';
import { NotesSidebar } from './components/NotesSidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Define the message structure for type safety
interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: number;
  filename: string;
  filetype: string;
  url: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color?: string;
  icon?: string;
  folderId?: string | null;
  isHiddenFromTopBar: boolean;
  createdAt: number;
  updatedAt: number;
  chatCount: number;
  attachments: Attachment[];
}

type ConfirmationMode = 'always' | 'never' | 'think';

interface AIResponse {
  response_text: string;
  updated_html: string;
  requires_confirmation: boolean;
}

const API_BASE_URL = 'http://127.0.0.1:5000';
const API_URL = `${API_BASE_URL}/api`;

function AuthenticatedApp() {
  const { token, logout, user } = useAuth();

  // Multi-note and folder state
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return localStorage.getItem('activeNoteId') || '';
  });
  const [noteOrder, setNoteOrder] = useState<string[]>(() => {
    const savedOrder = localStorage.getItem('noteOrder');
    return savedOrder ? JSON.parse(savedOrder) : [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('always');

  // AI Bubble states
  const [selectedText, setSelectedText] = useState('');
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });
  const [showBubble, setShowBubble] = useState(false);

  // AI Response Modal states
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [pendingAIResponse, setPendingAIResponse] = useState<AIResponse | null>(null);

  // Attachment Modal states
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);

  const editorRef = useRef<any>(null);

  // Save activeNoteId to localStorage
  useEffect(() => {
    if (activeNoteId) {
      localStorage.setItem('activeNoteId', activeNoteId);
    }
  }, [activeNoteId]);

  // Save noteOrder to localStorage
  useEffect(() => {
    if (noteOrder.length > 0) {
      localStorage.setItem('noteOrder', JSON.stringify(noteOrder));
    }
  }, [noteOrder]);

  // Fetch Notes and Folders on Mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch notes
        const notesResponse = await fetch(`${API_URL}/notes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (notesResponse.ok) {
          const notesData: Note[] = await notesResponse.json();

          // Sort notes based on saved order
          const savedOrder = localStorage.getItem('noteOrder');
          let sortedNotes = notesData;

          if (savedOrder) {
            const order: string[] = JSON.parse(savedOrder);
            sortedNotes = [...notesData].sort((a, b) => {
              const indexA = order.indexOf(a.id);
              const indexB = order.indexOf(b.id);
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1; // New items go to end
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
          }

          setNotes(sortedNotes);

          // Initialize active note if not set or invalid
          const savedActiveId = localStorage.getItem('activeNoteId');
          if (savedActiveId && notesData.find(n => n.id === savedActiveId)) {
            setActiveNoteId(savedActiveId);
          } else if (notesData.length > 0) {
            setActiveNoteId(notesData[0].id);
          }
        } else {
          console.error('Failed to fetch notes:', notesResponse.status);
        }

        // Fetch folders
        const foldersResponse = await fetch(`${API_URL}/folders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (foldersResponse.ok) {
          const foldersData = await foldersResponse.json();
          setFolders(foldersData);
        } else {
          console.error('Failed to fetch folders:', foldersResponse.status);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    if (token) fetchData();
  }, [token]);

  // Fetch Chat History when active note changes
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!activeNoteId) return;
      try {
        const response = await fetch(`${API_URL}/notes/${activeNoteId}/chat`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to fetch chat history:', error);
      }
    };
    if (activeNoteId && token) {
      fetchChatHistory();
    } else {
      setMessages([]);
    }
  }, [activeNoteId, token]);

  // Note Handlers
  const handleAddNote = async () => {
    try {
      const response = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'New Page', content: '' })
      });
      if (response.ok) {
        const newNote = await response.json();
        setNotes(prev => [newNote, ...prev]);
        setActiveNoteId(newNote.id);
      } else {
        console.error('Failed to create note:', response.status);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleSelectNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note && note.isHiddenFromTopBar) {
      handleUpdateNote(noteId, { isHiddenFromTopBar: false });
    }
    setActiveNoteId(noteId);
  };

  const handleUpdateNote = async (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...updates } : note));
    try {
      await fetch(`${API_URL}/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (notes.length <= 1) return;
    try {
      const response = await fetch(`${API_URL}/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const newNotes = notes.filter(n => n.id !== id);
        setNotes(newNotes);
        if (activeNoteId === id) {
          setActiveNoteId(newNotes[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleFileUpload = async (file: File, noteId: string) => {
    if (!token) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_URL}/notes/${noteId}/attachments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        const newAttachment: Attachment = await response.json();
        setNotes(prevNotes =>
          prevNotes.map(note =>
            note.id === noteId
              ? { ...note, attachments: [...(note.attachments || []), newAttachment] }
              : note
          )
        );
      } else {
        console.error('Failed to upload file:', response.status);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleAttachmentClick = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setShowAttachmentModal(true);
  };

  const closeAttachmentModal = () => {
    setShowAttachmentModal(false);
    setSelectedAttachment(null);
  };

  const handleDeleteAttachment = async (noteId: string, attachmentId: number) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotes(prevNotes =>
          prevNotes.map(note => {
            if (note.id === noteId) {
              return {
                ...note,
                attachments: note.attachments.filter(att => att.id !== attachmentId),
              };
            }
            return note;
          })
        );
      } else {
        console.error('Failed to delete attachment:', response.status);
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  const handleAddFolder = async () => {
    try {
      const response = await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: 'New Folder', icon: '📁' })
      });
      if (response.ok) {
        const newFolder = await response.json();
        setFolders(prev => [newFolder, ...prev]);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleUpdateFolder = async (id: string, updates: Partial<Folder>) => {
    setFolders(prev => prev.map(folder => folder.id === id ? { ...folder, ...updates } : folder));
    try {
      await fetch(`${API_URL}/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
    } catch (error) {
      console.error('Failed to update folder:', error);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setFolders(prev => prev.filter(f => f.id !== id));
        setNotes(prev => prev.map(note => note.folderId === id ? { ...note, folderId: null } : note));
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  const activeNote = notes.find(n => n.id === activeNoteId);

  const handleContentChange = (newContent: string) => {
    if (activeNoteId) {
      handleUpdateNote(activeNoteId, { content: newContent });
    }
  };

  const handleSendMessage = useCallback(async (message: string, pdfContext?: string) => {
    if (!message.trim() || !activeNote) return;
    setMessages(prev => [...prev, { sender: 'user', text: message }]);
    setIsLoading(true);
    setShowBubble(false);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          note_id: activeNoteId,
          message: message,
          content: activeNote.content,
          mode: confirmationMode,
          pdf_context: pdfContext,
          selected_text: selectedText
        }),
      });
      const data: AIResponse = await response.json();
      if (data.requires_confirmation) {
        setPendingAIResponse(data);
        setShowResponseModal(true);
      } else {
        handleUpdateNote(activeNoteId, { content: data.updated_html });
        setMessages(prev => [...prev, { sender: 'assistant', text: data.response_text }]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeNote, activeNoteId, confirmationMode, token, selectedText]);

  const handleTextSelect = useCallback((text: string, position: { x: number; y: number }) => {
    if (text.trim().length > 0) {
      setSelectedText(text);
      setBubblePosition(position);
      setShowBubble(true);
    } else {
      setShowBubble(false);
    }
  }, []);

  const handleBubbleAsk = useCallback((prompt: string) => {
    handleSendMessage(`${prompt}: "${selectedText}"`);
  }, [handleSendMessage, selectedText]);

  const handleAcceptResponse = useCallback(() => {
    if (pendingAIResponse && activeNoteId) {
      handleUpdateNote(activeNoteId, { content: pendingAIResponse.updated_html });
      setMessages(prev => [...prev, { sender: 'assistant', text: pendingAIResponse.response_text }]);
    }
    setShowResponseModal(false);
    setPendingAIResponse(null);
  }, [pendingAIResponse, activeNoteId]);

  const handleRejectResponse = useCallback(() => {
    if (pendingAIResponse) {
      setMessages(prev => [...prev, { sender: 'assistant', text: "Okay, I've discarded the changes." }]);
    }
    setShowResponseModal(false);
    setPendingAIResponse(null);
  }, [pendingAIResponse]);



  const handleReorderNotes = (newOrder: Note[]) => {
    setNotes(newOrder);
    const newOrderIds = newOrder.map(n => n.id);
    // Assuming setNoteOrder is a state setter for an array of note IDs
    // If not, this line might need adjustment or removal based on actual state management
    setNoteOrder(newOrderIds);
  };

  return (
    <div className="h-screen bg-dark-900 text-white flex flex-col font-sans">
      <div className="flex items-center justify-between px-6 py-2 border-b border-dark-700/50 bg-dark-900 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-200 tracking-wide">AI Notes</span>
          <span className="text-xs text-gray-500">v2.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Hi, {user?.username}</span>
          <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>

      <NotesBar
        notes={notes}
        activeNoteId={activeNoteId}
        onSelect={handleSelectNote}
        onAdd={handleAddNote}
        onUpdate={handleUpdateNote}
        onDelete={handleDeleteNote}
        onReorder={handleReorderNotes}
      />

      <NotesSidebar
        notes={notes}
        folders={folders}
        activeNoteId={activeNoteId}
        onSelect={handleSelectNote}
        onAddFolder={handleAddFolder}
        onUpdateNote={handleUpdateNote}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteNote={handleDeleteNote}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 bg-dark-900">
          <div className="w-full max-w-5xl mx-auto">
            {activeNote ? (
              <RichTextEditor
                content={activeNote.content}
                onChange={handleContentChange}
                editorRef={editorRef}
                onTextSelect={handleTextSelect}
                noteId={activeNote.id}
                attachments={activeNote.attachments || []}
                onFileUpload={handleFileUpload}
                onAttachmentClick={handleAttachmentClick}
                onDeleteAttachment={handleDeleteAttachment}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                <p>Select or create a note to start writing.</p>
                <button
                  onClick={handleAddNote}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>+</span> Create New Note
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-[350px] flex-shrink-0 h-full border-l border-dark-700/50 bg-dark-800/30 backdrop-blur-sm">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            mode={confirmationMode}
            onModeChange={setConfirmationMode}
            attachments={activeNote?.attachments || []}
          />
        </div>
      </div>

      <AnimatePresence>
        {showBubble && (
          <AIBubble
            position={bubblePosition}
            selectedText={selectedText}
            onAsk={handleBubbleAsk}
            onClose={() => setShowBubble(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResponseModal && pendingAIResponse && (
          <AIResponseModal
            response={pendingAIResponse.response_text}
            onAccept={handleAcceptResponse}
            onReject={handleRejectResponse}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAttachmentModal && selectedAttachment && (
          <AttachmentModal attachment={selectedAttachment} baseUrl={API_BASE_URL} onClose={closeAttachmentModal} />
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  const [view, setView] = useState<'login' | 'signup'>('login');

  return (
    <AuthProvider>
      <AuthWrapper view={view} setView={setView} />
    </AuthProvider>
  );
}

const AuthWrapper = ({ view, setView }: { view: 'login' | 'signup', setView: (v: 'login' | 'signup') => void }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <AuthenticatedApp />;
  }

  return view === 'login'
    ? <Login onSwitchToSignup={() => setView('signup')} />
    : <Signup onSwitchToLogin={() => setView('login')} />;
};

export default App;