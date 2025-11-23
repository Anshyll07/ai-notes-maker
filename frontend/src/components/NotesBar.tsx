import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit2, Palette, Smile, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    chatCount: number;
    folderId?: string | null;
    isHiddenFromTopBar: boolean;
    color?: string;
    icon?: string;
    attachments: any[];
}

interface NotesBarProps {
    notes: Note[];
    activeNoteId: string;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onUpdate: (id: string, updates: Partial<Note>) => void;
    onDelete: (id: string) => void;
}

const COLORS = [
    '#1f2937', // Default Dark
    '#7f1d1d', // Red
    '#7c2d12', // Orange
    '#713f12', // Yellow
    '#14532d', // Green
    '#1e3a8a', // Blue
    '#4c1d95', // Purple
    '#831843', // Pink
];

const ICONS = ['📝', '💡', '🚀', '⭐', '✅', '🔥', '📚', '💼'];

export const NotesBar: React.FC<NotesBarProps & { onReorder?: (newOrder: Note[]) => void }> = ({
    notes,
    activeNoteId,
    onSelect,
    onAdd,
    onUpdate,
    onDelete,
    onReorder
}) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter out notes that are hidden from top bar
    const visibleNotes = notes.filter(note => !note.isHiddenFromTopBar);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, noteId });
    };

    const startEditing = (note: Note) => {
        setEditingId(note.id);
        setEditTitle(note.title);
        setContextMenu(null);
    };

    const saveTitle = () => {
        if (editingId && editTitle.trim()) {
            onUpdate(editingId, { title: editTitle.trim() });
        }
        setEditingId(null);
    };

    const handleCloseNote = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        onUpdate(noteId, { isHiddenFromTopBar: true });
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 200;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div className="relative flex items-center w-full bg-dark-900 border-b border-dark-700/50 select-none">
            {/* Scroll Controls */}
            <button onClick={() => scroll('left')} className="p-2 hover:bg-dark-800 text-gray-400 hover:text-white transition-colors">
                <ChevronLeft size={16} />
            </button>

            {/* Notes List */}
            <div
                ref={scrollContainerRef}
                className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1 px-2 py-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <Reorder.Group
                    axis="x"
                    values={visibleNotes}
                    onReorder={(newOrder) => onReorder && onReorder(newOrder)}
                    className="flex gap-1"
                >
                    {visibleNotes.map((note) => (
                        <Reorder.Item
                            key={note.id}
                            value={note}
                            id={note.id}
                            onClick={() => onSelect(note.id)}
                            onContextMenu={(e) => handleContextMenu(e, note.id)}
                            className={`
              group relative flex items-center gap-2 px-4 py-2 min-w-[120px] max-w-[200px] rounded-t-lg cursor-pointer transition-all duration-200
              ${activeNoteId === note.id
                                    ? 'bg-dark-800 text-white border-b-2 border-blue-500'
                                    : 'text-gray-400 hover:bg-dark-800/50 hover:text-gray-200'}
            `}
                            style={{ backgroundColor: activeNoteId === note.id && note.color ? note.color : undefined }}
                            whileDrag={{ scale: 1.05, boxShadow: "0px 5px 15px rgba(0,0,0,0.3)", zIndex: 50 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        >
                            <span className="text-sm">{note.icon || '📄'}</span>

                            {editingId === note.id ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={saveTitle}
                                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                                    className="bg-transparent border-none outline-none text-sm w-full text-white"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="text-sm truncate font-medium">{note.title}</span>
                            )}

                            {/* Close button */}
                            <button
                                onClick={(e) => handleCloseNote(e, note.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-500/20 rounded"
                                title="Hide from top bar"
                            >
                                <X size={14} />
                            </button>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>

                {/* Add Button */}
                <button
                    onClick={onAdd}
                    className="flex items-center justify-center p-2 rounded-lg hover:bg-dark-800 text-gray-400 hover:text-white transition-colors ml-1"
                >
                    <Plus size={18} />
                </button>
            </div>

            <button onClick={() => scroll('right')} className="p-2 hover:bg-dark-800 text-gray-400 hover:text-white transition-colors">
                <ChevronRight size={16} />
            </button>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed z-50 bg-dark-800 border border-dark-700 shadow-xl rounded-lg p-1 min-w-[180px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => startEditing(visibleNotes.find(n => n.id === contextMenu.noteId)!)}
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
                                            onUpdate(contextMenu.noteId, { color });
                                            setContextMenu(null);
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
                                            onUpdate(contextMenu.noteId, { icon });
                                            setContextMenu(null);
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
                                    onDelete(contextMenu.noteId);
                                    setContextMenu(null);
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors text-left"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
