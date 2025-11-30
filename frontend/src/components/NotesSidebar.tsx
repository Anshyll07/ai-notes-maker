import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FolderPlus, Edit2, Palette, Smile, Trash2 } from 'lucide-react';
import type { Note } from './NotesBar';
import type { Folder } from '../App';

interface NotesSidebarProps {
    notes: Note[];
    folders: Folder[];
    activeNoteId: string;
    onSelect: (id: string) => void;
    onAddFolder: () => void;
    onUpdateNote: (id: string, updates: Partial<Note>) => void;
    onUpdateFolder: (id: string, updates: Partial<Folder>) => void;
    onDeleteFolder: (id: string) => void;
    onDeleteNote: (id: string) => void;
}

const COLORS = ['#1f2937', '#7f1d1d', '#7c2d12', '#713f12', '#14532d', '#1e3a8a', '#4c1d95', '#831843'];
const ICONS = ['📁', '📂', '🗂️', '📋', '📊', '🎯', '💼', '🔥'];

export const NotesSidebar: React.FC<NotesSidebarProps> = ({
    notes,
    folders,
    activeNoteId,
    onSelect,
    onAddFolder,
    onUpdateNote,
    onUpdateFolder,
    onDeleteFolder,
    onDeleteNote
}) => {
    const [isOpen, setIsOpen] = useState(() => {
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleSidebar = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        localStorage.setItem('sidebarOpen', JSON.stringify(newState));
    };
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editNoteTitle, setEditNoteTitle] = useState('');
    const [draggedNote, setDraggedNote] = useState<string | null>(null);
    const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
    const [noteContextMenu, setNoteContextMenu] = useState<{ noteId: string; x: number; y: number } | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ noteId: string; noteName: string } | null>(null);
    const [deleteFolderConfirmation, setDeleteFolderConfirmation] = useState<{ folderId: string; folderName: string } | null>(null);

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    const startEditingFolder = (folder: Folder) => {
        setEditingFolderId(folder.id);
        setEditFolderName(folder.name);
        setFolderContextMenu(null);
    };

    const saveFolderName = () => {
        if (editingFolderId && editFolderName.trim()) {
            onUpdateFolder(editingFolderId, { name: editFolderName.trim() });
        }
        setEditingFolderId(null);
    };

    const startEditingNote = (note: Note) => {
        setEditingNoteId(note.id);
        setEditNoteTitle(note.title);
        setNoteContextMenu(null);
    };

    const saveNoteTitle = () => {
        if (editingNoteId && editNoteTitle.trim()) {
            onUpdateNote(editingNoteId, { title: editNoteTitle.trim() });
        }
        setEditingNoteId(null);
    };

    const handleDragStart = (noteId: string) => {
        setDraggedNote(noteId);
    };

    const handleDrop = (folderId: string | null) => {
        if (draggedNote) {
            onUpdateNote(draggedNote, { folderId });
            setDraggedNote(null);
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
            }
            return `${hours}h ago`;
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days}d ago`;
        }
        return date.toLocaleDateString();
    };

    const notesInFolder = (folderId: string | null) =>
        notes.filter(note => note.folderId === folderId);

    const unfiledNotes = notesInFolder(null);
    const getContextFolder = () => folders.find(f => f.id === folderContextMenu?.folderId);
    const getContextNote = () => notes.find(n => n.id === noteContextMenu?.noteId);

    return (
        <>
            <div className={`fixed left-0 top-24 bottom-0 bg-dark-800 border-r border-dark-700 z-20 transition-all duration-300 ${isOpen ? 'w-64' : 'w-12'}`}>
                <button
                    onClick={toggleSidebar}
                    className="absolute top-2 left-2 p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors z-10"
                    title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>

                {isOpen && (
                    <div className="h-full flex flex-col pt-[70px]">
                        <div className="px-4 pb-3 flex items-center justify-between border-b border-dark-700">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Organize</h2>
                            <button
                                onClick={onAddFolder}
                                className="p-1.5 hover:bg-dark-700 rounded transition-colors"
                                title="Create folder"
                            >
                                <FolderPlus size={16} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {folders.length > 0 && (
                                <div className="space-y-1">
                                    {folders.map((folder) => (
                                        <div key={folder.id}>
                                            <div
                                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-700/50 cursor-pointer group"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setFolderContextMenu({ folderId: folder.id, x: e.clientX, y: e.clientY });
                                                }}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={() => handleDrop(folder.id)}
                                            >
                                                <button
                                                    onClick={() => toggleFolder(folder.id)}
                                                    className="p-0.5 hover:bg-dark-600 rounded"
                                                >
                                                    {expandedFolders.has(folder.id) ?
                                                        <ChevronDown size={14} className="text-gray-400" /> :
                                                        <ChevronUp size={14} className="text-gray-400" />
                                                    }
                                                </button>

                                                <span className="text-base">{folder.icon || '📁'}</span>

                                                {editingFolderId === folder.id ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={editFolderName}
                                                        onChange={(e) => setEditFolderName(e.target.value)}
                                                        onBlur={saveFolderName}
                                                        onKeyDown={(e) => e.key === 'Enter' && saveFolderName()}
                                                        className="flex-1 bg-transparent border-none outline-none text-sm text-white"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span
                                                        className="flex-1 text-sm font-medium text-gray-300 truncate"
                                                        onDoubleClick={() => startEditingFolder(folder)}
                                                    >
                                                        {folder.name}
                                                    </span>
                                                )}

                                                <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100">
                                                    {notesInFolder(folder.id).length}
                                                </span>
                                            </div>

                                            {expandedFolders.has(folder.id) && (
                                                <div className="ml-6 mt-1 space-y-1">
                                                    {notesInFolder(folder.id).map((note) => (
                                                        <div
                                                            key={note.id}
                                                            draggable
                                                            onDragStart={() => handleDragStart(note.id)}
                                                            onClick={() => onSelect(note.id)}
                                                            onContextMenu={(e) => {
                                                                e.preventDefault();
                                                                setNoteContextMenu({ noteId: note.id, x: e.clientX, y: e.clientY });
                                                            }}
                                                            className={`p-2 rounded-lg cursor-pointer transition-all text-sm ${activeNoteId === note.id
                                                                ? 'bg-blue-600/20 border border-blue-500/50'
                                                                : 'hover:bg-dark-700/50'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">{note.icon || '📝'}</span>
                                                                {editingNoteId === note.id ? (
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        value={editNoteTitle}
                                                                        onChange={(e) => setEditNoteTitle(e.target.value)}
                                                                        onBlur={saveNoteTitle}
                                                                        onKeyDown={(e) => e.key === 'Enter' && saveNoteTitle()}
                                                                        className="flex-1 bg-transparent border-none outline-none text-xs text-white"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        className="text-xs text-white truncate flex-1"
                                                                        onDoubleClick={() => startEditingNote(note)}
                                                                    >
                                                                        {note.title}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {folders.length > 0 && unfiledNotes.length > 0 && (
                                <div className="border-t border-dark-700 pt-3">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">Unfiled Notes</h3>
                                </div>
                            )}

                            <div
                                className="space-y-1"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(null)}
                            >
                                {unfiledNotes.map((note) => (
                                    <div
                                        key={note.id}
                                        draggable
                                        onDragStart={() => handleDragStart(note.id)}
                                        onClick={() => onSelect(note.id)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setNoteContextMenu({ noteId: note.id, x: e.clientX, y: e.clientY });
                                        }}
                                        className={`p-3 rounded-lg cursor-pointer transition-all ${activeNoteId === note.id
                                            ? 'bg-blue-600/20 border border-blue-500/50'
                                            : 'bg-dark-700/50 hover:bg-dark-700 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{note.icon || '📝'}</span>
                                            {editingNoteId === note.id ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editNoteTitle}
                                                    onChange={(e) => setEditNoteTitle(e.target.value)}
                                                    onBlur={saveNoteTitle}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveNoteTitle()}
                                                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-white"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span
                                                    className="text-sm font-medium text-white truncate flex-1"
                                                    onDoubleClick={() => startEditingNote(note)}
                                                >
                                                    {note.title}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formatDate(note.updatedAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {notes.length === 0 && folders.length === 0 && (
                                <p className="text-gray-500 text-sm text-center py-8">No folders or notes yet</p>
                            )}
                        </div>

                        <div className="px-4 py-3 border-t border-dark-700 text-xs text-gray-500">
                            Drag notes into folders • Right-click for options
                        </div>
                    </div>
                )}
            </div >

            <AnimatePresence>
                {folderContextMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setFolderContextMenu(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed z-50 bg-dark-800 border border-dark-700 shadow-xl rounded-lg p-1 min-w-[180px]"
                            style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => getContextFolder() && startEditingFolder(getContextFolder()!)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left"
                                >
                                    <Edit2 size={14} /> Rename
                                </button>

                                <div className="h-px bg-dark-700 my-1" />

                                <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-500 font-medium">
                                    <Palette size={12} /> Color
                                </div>
                                <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                                    {COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                onUpdateFolder(folderContextMenu.folderId, { color });
                                                setFolderContextMenu(null);
                                            }}
                                            className="w-6 h-6 rounded-full border border-dark-600 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>

                                <div className="h-px bg-dark-700 my-1" />

                                <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-500 font-medium">
                                    <Smile size={12} /> Icon
                                </div>
                                <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                                    {ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => {
                                                onUpdateFolder(folderContextMenu.folderId, { icon });
                                                setFolderContextMenu(null);
                                            }}
                                            className="w-6 h-6 flex items-center justify-center hover:bg-dark-700 rounded text-sm transition-colors"
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>

                                <div className="h-px bg-dark-700 my-1" />

                                <button
                                    onClick={() => {
                                        const folder = getContextFolder()!;
                                        setDeleteFolderConfirmation({ folderId: folder.id, folderName: folder.name });
                                        setFolderContextMenu(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors text-left"
                                >
                                    <Trash2 size={14} /> Delete Folder
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {noteContextMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setNoteContextMenu(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed z-50 bg-dark-800 border border-600 rounded-lg shadow-xl p-4 min-w-[200px]"
                            style={{ left: noteContextMenu.x, top: noteContextMenu.y }}
                        >
                            {getContextNote() && (
                                <div className="space-y-2 text-sm">
                                    <div className="pb-2 border-b border-dark-600">
                                        <div className="flex items-center gap-2 font-semibold text-white">
                                            <span>{getContextNote()!.icon || '📝'}</span>
                                            <span className="truncate">{getContextNote()!.title}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-gray-300">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Created:</span>
                                            <span>{new Date(getContextNote()!.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Last edited:</span>
                                            <span>{formatDate(getContextNote()!.updatedAt)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">AI chats:</span>
                                            <span className="font-semibold text-blue-400">{getContextNote()!.chatCount}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-dark-600 space-y-1">
                                        <button
                                            onClick={() => getContextNote() && startEditingNote(getContextNote()!)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left"
                                        >
                                            <Edit2 size={14} /> Rename
                                        </button>

                                        <div className="h-px bg-dark-700 my-1" />

                                        <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-500 font-medium">
                                            <Palette size={12} /> Color
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                                            {COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => {
                                                        onUpdateNote(noteContextMenu.noteId, { color });
                                                        setNoteContextMenu(null);
                                                    }}
                                                    className="w-6 h-6 rounded-full border border-dark-600 hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>

                                        <div className="h-px bg-dark-700 my-1" />

                                        <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-500 font-medium">
                                            <Smile size={12} /> Icon
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                                            {ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    onClick={() => {
                                                        onUpdateNote(noteContextMenu.noteId, { icon });
                                                        setNoteContextMenu(null);
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center hover:bg-dark-700 rounded text-sm transition-colors"
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="h-px bg-dark-700 my-1" />

                                        <button
                                            onClick={() => {
                                                const note = getContextNote()!;
                                                setDeleteConfirmation({ noteId: note.id, noteName: note.title });
                                                setNoteContextMenu(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors text-left"
                                        >
                                            <Trash2 size={14} /> Delete Note
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Delete Note Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirmation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setDeleteConfirmation(null)}>
                        <div className="fixed inset-0 bg-black/50" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative bg-dark-800 border border-dark-700 rounded-lg shadow-2xl p-6 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg">
                                        <Trash2 size={24} className="text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Delete Note?</h3>
                                        <p className="text-sm text-gray-400">This action cannot be undone</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-dark-700/50 rounded-lg">
                                    <p className="text-sm text-gray-300">
                                        Are you sure you want to delete <span className="font-semibold text-white">"{deleteConfirmation.noteName}"</span>?
                                    </p>
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setDeleteConfirmation(null)}
                                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            onDeleteNote(deleteConfirmation.noteId);
                                            setDeleteConfirmation(null);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Folder Confirmation Modal */}
            <AnimatePresence>
                {deleteFolderConfirmation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setDeleteFolderConfirmation(null)}>
                        <div className="fixed inset-0 bg-black/50" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative bg-dark-800 border border-dark-700 rounded-lg shadow-2xl p-6 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg">
                                        <Trash2 size={24} className="text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Delete Folder?</h3>
                                        <p className="text-sm text-gray-400">This action cannot be undone</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-dark-700/50 rounded-lg">
                                    <p className="text-sm text-gray-300">
                                        Are you sure you want to delete <span className="font-semibold text-white">"{deleteFolderConfirmation.folderName}"</span>?
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Notes in this folder will be moved to "Unfiled Notes".
                                    </p>
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setDeleteFolderConfirmation(null)}
                                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            onDeleteFolder(deleteFolderConfirmation.folderId);
                                            setDeleteFolderConfirmation(null);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 size={16} />
                                        Delete Folder
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
