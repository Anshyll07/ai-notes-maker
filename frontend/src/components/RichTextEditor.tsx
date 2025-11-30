import { useEffect, useState, useRef, useCallback } from 'react';

import { useEditor, EditorContent } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Download, RefreshCw, Crop, Maximize2, Minimize2, Sparkles, Image as ImageIcon } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { FontFamily } from '@tiptap/extension-font-family';
import { Underline } from '@tiptap/extension-underline';
import Mathematics from '@tiptap/extension-mathematics';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import TiptapImage from '@tiptap/extension-image';
import 'katex/dist/katex.min.css';
import ShapeOverlay from './ShapeOverlay';
import ImageCropModal from './ImageCropModal';
import AIImageModal from './AIImageModal';

interface Shape {
  id: string;
  type: 'box' | 'circle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
}

interface Attachment {
  id: number;
  filename: string;
  filetype: string;
  url: string;
  summary?: string;
  summaryStatus?: 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled';
}

interface RichTextEditorProps {
  noteId: string | undefined;
  content: string;
  onChange: (content: string) => void;
  onTextSelect?: (text: string, position: { x: number; y: number }) => void;
  editorRef?: React.MutableRefObject<any>;
  onTableActiveChange?: (isActive: boolean) => void;
  attachments: Attachment[];
  onFileUpload: (file: File, noteId: string) => void;
  onAttachmentClick: (attachment: Attachment) => void;
  onDeleteAttachment: (noteId: string, attachmentId: number) => void;
  onRegenerateSummary: (attachmentId: number, noteId: string) => void;
  onCancelSummary: (attachmentId: number, noteId: string) => void;
  onImageUpload: (file: File) => Promise<string>;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ noteId, content, onChange, onTextSelect, editorRef, onTableActiveChange, attachments, onFileUpload, onAttachmentClick, onDeleteAttachment, onRegenerateSummary, onCancelSummary, onImageUpload }) => {
  const [highlightColor, setHighlightColor] = useState('#ffc078');
  const [selectedFont, setSelectedFont] = useState('Inter');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [deleteAttachmentConfirmation, setDeleteAttachmentConfirmation] = useState<Attachment | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily.configure({
        types: ['textStyle'],
      }),
      Underline,
      Mathematics,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TiptapImage.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            class: {
              default: null,
              parseHTML: element => element.getAttribute('class'),
              renderHTML: attributes => {
                if (!attributes.class) {
                  return {};
                }
                return {
                  class: attributes.class,
                };
              },
            },
            width: {
              default: null,
              parseHTML: element => element.getAttribute('width'),
              renderHTML: attributes => ({
                width: attributes.width,
              }),
            },
            height: {
              default: null,
              parseHTML: element => element.getAttribute('height'),
              renderHTML: attributes => ({
                height: attributes.height,
              }),
            },
            style: {
              default: null,
              parseHTML: element => element.getAttribute('style'),
              renderHTML: attributes => ({
                style: attributes.style,
              }),
            },
          };
        },
      }).configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      onTableActiveChange?.(editor.isActive('table'));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[600px] p-4',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Fix event listener types
  useEffect(() => {
    if (!editor) return;

    const handleImageClick = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG') {
        // Handle image click if needed
      }
    };

    const element = editor.view.dom;
    element.addEventListener('click', handleImageClick);
    return () => {
      element.removeEventListener('click', handleImageClick);
    };
  }, [editor]);

  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // Effect to handle internal ToC link clicks
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.getAttribute('href')?.startsWith('#')) {
        event.preventDefault(); // <-- This should stop navigation

        // Crucially, remove target attribute to prevent new tab opening
        link.removeAttribute('target');

        const id = link.getAttribute('href')?.substring(1);
        if (id) {
          // The editor content is in the same document, so we can query globally
          const headingElement = document.getElementById(id);
          if (headingElement) {
            headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    const editorElement = editor.options.element as HTMLElement;
    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
    }

    return () => {
      if (editorElement) {
        editorElement.removeEventListener('click', handleClick);
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !onTextSelect) return;

    const handleSelectionChange = () => {
      const { from, to } = editor.state.selection;
      let text = editor.state.doc.textBetween(from, to, ' ');

      // Check for math node selection if text is empty
      if (!text.trim()) {
        const selection = editor.state.selection as any;
        if (selection.node && (selection.node.type.name === 'mathematics' || selection.node.type.name === 'math')) {
          // Extract LaTeX content
          text = selection.node.textContent || selection.node.attrs.latex || '';
          // Ensure it's wrapped in $ for context
          if (text && !text.startsWith('$')) {
            text = `$${text}$`;
          }
        }
      }

      if (text.trim()) {
        const coords = editor.view.coordsAtPos(from);
        onTextSelect(text, { x: coords.left, y: coords.bottom + 10 });
      } else {
        // Also hide bubble if selection is cleared
        onTextSelect('', { x: 0, y: 0 });
      }
    };

    editor.on('selectionUpdate', handleSelectionChange);

    // Also handle table active state on selection update
    const handleTableActiveState = () => {
      onTableActiveChange?.(editor.isActive('table'));
    }
    editor.on('selectionUpdate', handleTableActiveState);

    return () => {
      editor.off('selectionUpdate', handleSelectionChange);
      editor.off('selectionUpdate', handleTableActiveState);
    };
  }, [editor, onTableActiveChange, onTextSelect]);

  // Handle image clicks for lightbox
  useEffect(() => {
    if (!editor) return;

    const handleImageClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && target.closest('.ProseMirror')) {
        const src = (target as HTMLImageElement).src;
        if (src) {
          setLightboxImage(src);
        }
      }
    };

    // Attach listener to the editor element
    const editorElement = editor.options.element as HTMLElement;
    if (editorElement) {
      editorElement.addEventListener('click', handleImageClick);
    }

    return () => {
      if (editorElement) {
        editorElement.removeEventListener('click', handleImageClick);
      }
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  // Removed unused addShape function

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const handleFileButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Prevent form submission
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (noteId) {
        onFileUpload(file, noteId);
      }
      event.target.value = ''; // Clear the input after selection
    }
  };

  const findImagePos = (img: HTMLImageElement): number | null => {
    if (!editor) return null;

    // Strategy 1: Iterate all images and check if their DOM node matches our target img
    // This is the most robust way to handle duplicates.
    const { doc } = editor.state;
    let foundPos: number | null = null;

    doc.descendants((node, pos) => {
      if (foundPos !== null) return false;
      if (node.type.name === 'image') {
        try {
          const domNode = editor.view.nodeDOM(pos);
          if (domNode === img) {
            foundPos = pos;
            return false;
          }
        } catch (e) {
          // Ignore errors accessing nodeDOM
        }
      }
    });

    if (foundPos !== null) return foundPos;

    // Strategy 2: Fallback to src matching (original logic)
    // Only used if Strategy 1 fails (e.g. if View is out of sync or nodeDOM fails)
    doc.descendants((node, pos) => {
      if (foundPos !== null) return false;
      if (node.type.name === 'image' && node.attrs.src === img.src) {
        foundPos = pos;
        return false;
      }
    });
    return foundPos;
  };

  // Handle inline image upload
  const handleImageButtonClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const url = await onImageUpload(file);
        if (url && editor) {
          // If there's a contextMenuImage, replace it. Otherwise, insert new.
          if (contextMenuImage) {
            const pos = findImagePos(contextMenuImage);
            if (pos !== null) {
              editor.chain().setNodeSelection(pos).updateAttributes('image', { src: url }).run();
            }
          } else {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }
      } catch (error) {
        console.error("Failed to upload image", error);
      }
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
    closeContextMenu(); // Close context menu after action
  };

  const handleDeleteConfirm = () => {
    if (deleteAttachmentConfirmation && noteId) {
      onDeleteAttachment(noteId, deleteAttachmentConfirmation.id);
    }
    setDeleteAttachmentConfirmation(null);
  };

  const truncateFilename = (filename: string, maxLength: number = 25) => {
    if (filename.length <= maxLength) return filename;

    const extension = filename.slice(filename.lastIndexOf('.'));
    const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'));
    const truncatedLength = maxLength - extension.length - 3; // 3 for "..."

    if (truncatedLength <= 0) return filename;

    return `${nameWithoutExt.slice(0, truncatedLength)}...${extension}`;
  };

  // Image toolbar state
  const [selectedImageEl, setSelectedImageEl] = useState<HTMLImageElement | null>(null);
  const [imageToolbarPos, setImageToolbarPos] = useState<{ top: number; left: number } | null>(null);

  // Context Menu & Crop State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuImage, setContextMenuImage] = useState<HTMLImageElement | null>(null);

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; image: HTMLImageElement } | null>(null);

  const handleImageContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.closest('.ProseMirror')) {
      e.preventDefault();
      setContextMenuImage(target as HTMLImageElement);
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      // Show resize handles on right click
      setSelectedImageEl(target as HTMLImageElement);
    }
  };

  const closeContextMenu = () => {
    setContextMenuPos(null);
    setContextMenuImage(null);
    // Keep selectedImageEl to allow resizing after menu closes? 
    // Or maybe user wants to resize WHILE menu is open.
    // Let's keep it selected.
  };

  const handleDownloadImage = () => {
    if (contextMenuImage) {
      const link = document.createElement('a');
      link.href = contextMenuImage.src;
      link.download = 'image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    closeContextMenu();
  };

  const handleReplaceImageLocal = () => {
    if (contextMenuImage) {
      imageInputRef.current?.click();
      // The handleImageInputChange will use contextMenuImage to replace the correct image.
    }
    closeContextMenu();
  };

  const handleReplaceImageAI = () => {
    if (contextMenuImage) {
      setAiModalOpen(true);
      setContextMenuPos(null); // Only hide the menu, keep the image ref
    }
  };

  const handleGenerateImage = async (imageUrl: string) => {
    // The modal now returns the selected image URL directly

    // Replace the image
    if (contextMenuImage && editor) {
      const pos = findImagePos(contextMenuImage);
      if (pos !== null) {
        editor.chain().setNodeSelection(pos).updateAttributes('image', { src: imageUrl }).run();
      }
    }
    setAiModalOpen(false);
    closeContextMenu();
  };

  const handleCropImage = () => {
    if (contextMenuImage) {
      setImageToCrop(contextMenuImage.src);
      setCropModalOpen(true);
    }
    closeContextMenu();
  };

  const handleDeleteImage = () => {
    if (contextMenuImage && editor) {
      const pos = findImagePos(contextMenuImage);
      if (pos !== null) {
        editor.chain().deleteRange({ from: pos, to: pos + 1 }).run();
      }
    }
    closeContextMenu();
  };

  // Resize Logic
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateOverlayPos = useCallback(() => {
    if (selectedImageEl && overlayRef.current) {
      const rect = selectedImageEl.getBoundingClientRect();
      overlayRef.current.style.top = `${rect.top}px`;
      overlayRef.current.style.left = `${rect.left}px`;
      overlayRef.current.style.width = `${rect.width}px`;
      overlayRef.current.style.height = `${rect.height}px`;
    }
  }, [selectedImageEl]);

  useEffect(() => {
    updateOverlayPos();
    window.addEventListener('scroll', updateOverlayPos, true);
    window.addEventListener('resize', updateOverlayPos);
    return () => {
      window.removeEventListener('scroll', updateOverlayPos, true);
      window.removeEventListener('resize', updateOverlayPos);
    };
  }, [updateOverlayPos]);

  const startResize = (e: React.MouseEvent, direction: string) => {
    if (!selectedImageEl) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    closeContextMenu();

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: selectedImageEl.clientWidth,
      startHeight: selectedImageEl.clientHeight,
      image: selectedImageEl
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;

      const { startX, startY, startWidth, startHeight, image } = resizeRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newWidth = Math.max(50, startWidth + deltaX);
      const newHeight = Math.max(50, startHeight + deltaY);

      // Update image style
      image.style.width = `${newWidth}px`;
      image.style.height = `${newHeight}px`;

      // Update overlay style directly
      if (overlayRef.current) {
        // We need to recalculate top/left because resizing might shift the image (if centered/aligned)
        // But for simple bottom-right resize, top/left usually stays.
        // However, getBoundingClientRect is safest.
        const rect = image.getBoundingClientRect();
        overlayRef.current.style.top = `${rect.top}px`;
        overlayRef.current.style.left = `${rect.left}px`;
        overlayRef.current.style.width = `${rect.width}px`;
        overlayRef.current.style.height = `${rect.height}px`;
      }
    };

    const handleMouseUp = () => {
      if (isResizing && resizeRef.current && editor) {
        const { image } = resizeRef.current;
        const width = image.style.width;
        const height = image.style.height;

        const pos = findImagePos(image);
        if (pos !== null) {
          const currentClass = image.getAttribute('class') || '';
          const newClass = currentClass.replace(/\b(w-\[[^\]]+\]|h-\[[^\]]+\])\b/g, '').trim();

          editor.chain().setNodeSelection(pos).updateAttributes('image', {
            width,
            height,
            class: newClass,
            style: `width: ${width}; height: ${height}`
          }).run();
        }

        setIsResizing(false);
        resizeRef.current = null;
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, editor]);

  const handleCropComplete = (croppedImage: string) => {
    // Replace the image source
    // We need to find the image node again because contextMenuImage might be stale reference if re-rendered?
    // Actually src is unique enough usually.
    if (imageToCrop && editor) {
      // Find image with this src
      const { doc } = editor.state;
      let found = false;
      doc.descendants((node, pos) => {
        if (!found && node.type.name === 'image' && node.attrs.src === imageToCrop) {
          editor.chain().setNodeSelection(pos).updateAttributes('image', { src: croppedImage }).run();
          found = true;
        }
      });
    }
    setCropModalOpen(false);
    setImageToCrop(null);
    closeContextMenu();
  };



  // ... (rest of functions)

  // Handle image click to show toolbar
  useEffect(() => {
    const editorElement = editor?.options.element as HTMLElement; // Define editorElement here
    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG' && editorElement?.contains(target)) {
        // User requested: RESIZE WILL COME WHEN I RIGHT CLICK... RATHER THAN LEFT CLICK
        // So we DO NOT select on left click anymore.
        // setSelectedImageEl(target as HTMLImageElement); 
        setSelectedImageEl(null); // Clear selection on left click if they want strictly right click
      } else {
        // Only deselect if not resizing and not clicking context menu
        if (!isResizing) {
          setSelectedImageEl(null);
          setImageToolbarPos(null);
        }
      }
    };

    // Add context menu listener
    const handleContextMenu = (e: Event) => handleImageContextMenu(e as MouseEvent);

    if (editorElement) {
      editorElement.addEventListener('click', handleClick);
      editorElement.addEventListener('contextmenu', handleContextMenu);
      return () => {
        editorElement.removeEventListener('click', handleClick);
        editorElement.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [editor, isResizing]);

  // Drag and drop functionality for images
  useEffect(() => {
    const editorElement = editor?.options.element as HTMLElement;
    if (!editorElement) return;

    let draggedImage: HTMLImageElement | null = null;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        draggedImage = target as HTMLImageElement;
        draggedImage.style.opacity = '0.5';
        e.dataTransfer!.effectAllowed = 'move';
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && target !== draggedImage) {
        target.style.outline = '2px dashed #3b82f6';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        target.style.outline = '';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;

      if (target.tagName === 'IMG' && draggedImage && target !== draggedImage) {
        // Apply inline-block to both images so they appear side-by-side
        const inlineClass = 'rounded-xl m-2 w-[300px] h-[200px] object-cover cursor-pointer shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 inline-block';

        draggedImage.className = inlineClass;
        (target as HTMLImageElement).className = inlineClass;

        // Trigger Tiptap update
        editor?.commands.setContent(editor?.getHTML() || '');

        // Remove outline
        target.style.outline = '';
      }

      if (draggedImage) {
        draggedImage.style.opacity = '1';
        draggedImage = null;
      }
    };

    const handleDragEnd = () => {
      if (draggedImage) {
        draggedImage.style.opacity = '1';
        draggedImage = null;
      }

      // Clean up any outlines
      const images = editorElement.querySelectorAll('img');
      images.forEach(img => {
        (img as HTMLElement).style.outline = '';
      });
    };

    // Make all images draggable
    const makeImagesDraggable = () => {
      const images = editorElement.querySelectorAll('img');
      images.forEach(img => {
        img.setAttribute('draggable', 'true');
      });
    };

    makeImagesDraggable();

    // Set up event listeners
    editorElement.addEventListener('dragstart', handleDragStart as EventListener);
    editorElement.addEventListener('dragover', handleDragOver as EventListener);
    editorElement.addEventListener('dragleave', handleDragLeave as EventListener);
    editorElement.addEventListener('drop', handleDrop as EventListener);
    editorElement.addEventListener('dragend', handleDragEnd);

    // Re-make images draggable when content changes
    const observer = new MutationObserver(makeImagesDraggable);
    observer.observe(editorElement, { childList: true, subtree: true });

    return () => {
      editorElement.removeEventListener('dragstart', handleDragStart as EventListener);
      editorElement.removeEventListener('dragover', handleDragOver as EventListener);
      editorElement.removeEventListener('dragleave', handleDragLeave as EventListener);
      editorElement.removeEventListener('drop', handleDrop as EventListener);
      editorElement.removeEventListener('dragend', handleDragEnd);
      observer.disconnect();
    };
  }, [editor]);

  const applyImageAlignment = (alignmentClass: string) => {
    // Use contextMenuImage if available (for context menu actions), otherwise selectedImageEl
    const targetImage = contextMenuImage || selectedImageEl;

    if (!targetImage || !editor) return;

    // Find the image position in the editor using our robust helper
    const imagePos = findImagePos(targetImage);

    if (imagePos !== null) {
      // Use TipTap's updateAttributes command to update the image's class
      editor.chain()
        .focus()
        .setNodeSelection(imagePos)
        .updateAttributes('image', { class: alignmentClass })
        .run();
    }

    // Clear selection
    // Don't clear contextMenuImage here as we might want to do more actions
    // But we should close the menu
    closeContextMenu();
    setSelectedImageEl(null);
    setImageToolbarPos(null);
  };

  return (
    <div className="relative rounded-lg bg-dark-900 shadow-2xl">
      {/* Shape Overlay */}
      <ShapeOverlay shapes={shapes} onUpdateShapes={setShapes} />

      {/* Top Toolbar */}
      <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2 p-2 bg-dark-800/50 border-b border-dark-700/50 z-10 backdrop-blur-sm">
        {/* Text Formatting */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`w - 8 h - 8 flex items - center justify - center rounded - md transition - all duration - 150 ${editor.isActive('bold')
              ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Bold (Ctrl+B)"
          >
            <span className="material-symbols-outlined text-lg">format_bold</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`w - 8 h - 8 flex items - center justify - center rounded - md transition - all duration - 150 ${editor.isActive('italic')
              ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Italic (Ctrl+I)"
          >
            <span className="material-symbols-outlined text-lg">format_italic</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`w - 8 h - 8 flex items - center justify - center rounded - md transition - all duration - 150 ${editor.isActive('underline')
              ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Underline (Ctrl+U)"
          >
            <span className="material-symbols-outlined text-lg">format_underlined</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`w - 8 h - 8 flex items - center justify - center rounded - md transition - all duration - 150 ${editor.isActive('strike')
              ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Strikethrough"
          >
            <span className="material-symbols-outlined text-lg">format_strikethrough</span>
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Headings */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`w - 8 h - 8 flex items - center justify - center rounded - md text - sm font - bold transition - all duration - 150 ${editor.isActive('heading', { level: 1 })
              ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`w - 8 h - 8 flex items - center justify - center rounded - md text - sm font - bold transition - all duration - 150 ${editor.isActive('heading', { level: 2 })
              ? 'bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`w - 9 h - 8 flex items - center justify - center rounded - md text - [10px] font - bold transition - all duration - 150 ${editor.isActive('heading', { level: 3 })
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Lists */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`w - 9 h - 8 flex items - center justify - center rounded - md text - lg transition - all duration - 150 ${editor.isActive('bulletList')
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`w - 9 h - 8 flex items - center justify - center rounded - md text - sm font - semibold transition - all duration - 150 ${editor.isActive('orderedList')
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="Numbered List"
          >
            1.
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Table & Image */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={insertTable}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Insert Table"
          >
            <span className="material-symbols-outlined text-base">table</span>
          </button>
          <button
            onClick={handleImageButtonClick}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Insert Image"
          >
            <span className="material-symbols-outlined text-base">image</span>
          </button>
          <input
            type="file"
            accept="image/*"
            ref={imageInputRef}
            onChange={handleImageInputChange}
            className="hidden"
          />
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>



        {/* File Attach */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleFileButtonClick}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Attach File"
          >
            <span className="material-symbols-outlined text-base">attachment</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Colors & Font */}
        <div className="flex items-center gap-2">
          <input
            type="color"
            onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
            className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-2 border-dark-600 hover:border-blue-500 transition-all"
            title="Text Color"
          >
          </input>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
            onInput={(e) => editor.chain().focus().toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()}
            className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-2 border-dark-600 hover:border-yellow-500 transition-all"
            title="Highlight Color"
          >
          </input>
          <select
            value={selectedFont}
            onChange={(e) => {
              setSelectedFont(e.target.value);
              editor.chain().focus().setFontFamily(e.target.value).run();
            }}
            className="px-2 py-1.5 text-xs rounded-md bg-dark-700/80 text-gray-300 border border-transparent hover:border-purple-500 focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
            title="Font Family"
          >
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Comic Sans MS">Comic Sans</option>
            <option value="Verdana">Verdana</option>
          </select>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Show Summary */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowSummaryModal(true)}
            disabled={attachments.length === 0}
            className={`w - 9 h - 9 flex items - center justify - center rounded - md transition - all duration - 150 ${attachments.length === 0
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              } `}
            title="View Attachment Summaries"
          >
            <span className="material-symbols-outlined text-base">summarize</span>
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative">
        <style>{`
      .ProseMirror img {
      border - radius: 0.75rem!important;
    }
    `}</style>
        <EditorContent editor={editor} className="min-h-[500px]" />

        {/* Image Alignment Toolbar */}


        {/* Resize Handles Overlay - Fixed Position */}
        {selectedImageEl && (
          <div
            ref={overlayRef}
            className="fixed pointer-events-none border-2 border-blue-500 z-[100]"
            style={{
              // Initial styles will be set by updateOverlayPos
              display: 'block'
            }}
          >
            {/* Bottom Right Handle */}
            <div
              className="absolute bottom-[-6px] right-[-6px] w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize pointer-events-auto shadow-md"
              onMouseDown={(e) => startResize(e, 'se')}
            />
          </div>
        )}

        {/* Context Menu */}
        <AnimatePresence>
          {contextMenuPos && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed z-50 bg-dark-800 border border-dark-700 shadow-xl rounded-lg p-1 min-w-[180px]"
                style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-1">
                  {/* Alignment Options */}
                  <div className="flex justify-between px-2 py-1 bg-dark-900/50 rounded mb-1">
                    <button
                      onClick={() => applyImageAlignment('rounded-xl m-2 w-[300px] h-[200px] object-cover cursor-pointer shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 float-left')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded"
                      title="Float Left"
                    >
                      <span className="material-symbols-outlined text-sm">format_align_left</span>
                    </button>
                    <button
                      onClick={() => applyImageAlignment('rounded-xl m-2 w-[300px] h-[200px] object-cover cursor-pointer shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 block mx-auto')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded"
                      title="Center"
                    >
                      <span className="material-symbols-outlined text-sm">format_align_center</span>
                    </button>
                    <button
                      onClick={() => applyImageAlignment('rounded-xl m-2 w-[300px] h-[200px] object-cover cursor-pointer shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 float-right')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded"
                      title="Float Right"
                    >
                      <span className="material-symbols-outlined text-sm">format_align_right</span>
                    </button>
                    <button
                      onClick={() => applyImageAlignment('rounded-xl m-2 w-[300px] h-[200px] object-cover cursor-pointer shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 inline-block')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded"
                      title="Inline"
                    >
                      <span className="material-symbols-outlined text-sm">view_column</span>
                    </button>
                    <button
                      onClick={() => applyImageAlignment('rounded-xl m-2 w-[300px] h-[200px] object-cover cursor-pointer shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-dark-700 rounded"
                      title="Remove Alignment"
                    >
                      <span className="material-symbols-outlined text-sm">format_clear</span>
                    </button>
                  </div>

                  <div className="h-px bg-dark-700 my-1" />

                  <button onClick={handleDownloadImage} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left">
                    <Download size={14} /> Download
                  </button>

                  {/* Replace Options */}
                  <div className="relative group">
                    <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left">
                      <div className="flex items-center gap-2">
                        <RefreshCw size={14} /> Replace
                      </div>
                      <span className="text-xs text-gray-500">▶</span>
                    </button>
                    {/* Submenu */}
                    <div className="absolute left-full top-0 ml-1 bg-dark-800 border border-dark-700 shadow-xl rounded-lg p-1 min-w-[160px] hidden group-hover:block">
                      <button onClick={handleReplaceImageLocal} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left">
                        <ImageIcon size={14} /> From Device
                      </button>
                      <button onClick={handleReplaceImageAI} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-400 hover:bg-dark-700 rounded transition-colors text-left">
                        <Sparkles size={14} /> With AI
                      </button>
                    </div>
                  </div>

                  <button onClick={handleCropImage} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 rounded transition-colors text-left">
                    <Crop size={14} /> Crop & Rotate
                  </button>
                  <div className="h-px bg-dark-700 my-1" />
                  <button onClick={handleDeleteImage} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors text-left">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <ImageCropModal
          isOpen={cropModalOpen}
          imageSrc={imageToCrop}
          onClose={() => setCropModalOpen(false)}
          onCropComplete={handleCropComplete}
        />

        <AIImageModal
          isOpen={aiModalOpen}
          onClose={() => {
            setAiModalOpen(false);
            closeContextMenu();
          }}
          onGenerate={handleGenerateImage}
          sourceImageSrc={contextMenuImage?.src || null}
        />
      </div >
      {/* Attachments display area */}
      {
        attachments.length > 0 && (
          <div className="p-4 border-t border-dark-700/50">
            <h3 className="text-gray-400 text-sm mb-2">Attachments: [{attachments.length}] Attachments</h3>
            <div className="flex flex-wrap gap-2">
              {attachments.map(attachment => (
                <div key={attachment.id} className="flex items-center gap-1 bg-dark-700 rounded-md">
                  <button
                    onClick={() => onAttachmentClick(attachment)}
                    className="flex items-center gap-1 px-3 py-1 hover:bg-dark-600 rounded-l-md text-gray-300 text-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {attachment.filetype === 'pdf' ? 'picture_as_pdf' : 'image'}
                    </span>
                    <span title={attachment.filename}>{truncateFilename(attachment.filename)}</span>
                    {/* Summary status indicator */}
                    {attachment.summaryStatus === 'processing' || attachment.summaryStatus === 'pending' ? (
                      <span className="material-symbols-outlined text-sm text-blue-400 animate-spin" title="Generating summary...">
                        progress_activity
                      </span>
                    ) : attachment.summaryStatus === 'complete' ? (
                      <span className="material-symbols-outlined text-sm text-green-400" title="Summary ready">
                        check_circle
                      </span>
                    ) : attachment.summaryStatus === 'failed' ? (
                      <span className="material-symbols-outlined text-sm text-red-400" title="Summary failed">
                        error
                      </span>
                    ) : null}
                  </button>
                  <button
                    onClick={() => setDeleteAttachmentConfirmation(attachment)}
                    className="p-1 pr-2 text-gray-500 hover:text-red-400 hover:bg-dark-600 rounded-r-md transition-colors"
                    title="Delete attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      }


      {/* Delete Attachment Confirmation Modal */}
      <AnimatePresence>
        {deleteAttachmentConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setDeleteAttachmentConfirmation(null)}>
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
                    <h3 className="text-lg font-semibold text-white">Delete Attachment?</h3>
                    <p className="text-sm text-gray-400">This action cannot be undone</p>
                  </div>
                </div>

                <div className="p-3 bg-dark-700/50 rounded-lg">
                  <p className="text-sm text-gray-300">
                    Are you sure you want to delete <span className="font-semibold text-white">"{deleteAttachmentConfirmation.filename}"</span>?
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteAttachmentConfirmation(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
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

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowSummaryModal(false)}>
            <div className="fixed inset-0 bg-black/60" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-dark-800 border border-dark-700 rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined">summarize</span>
                  Attachment Summaries
                </h3>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-4 pr-2">
                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <span className="material-symbols-outlined text-5xl mb-2 opacity-50">attach_file</span>
                    <p>No attachments found</p>
                  </div>
                ) : (
                  attachments.map((attachment) => (
                    <div key={attachment.id} className="bg-dark-700/50 rounded-lg p-4 border border-dark-600">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-2xl text-blue-400">
                          {attachment.filetype === 'pdf' ? 'picture_as_pdf' : 'image'}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-white" title={attachment.filename}>
                                {truncateFilename(attachment.filename, 35)}
                              </h4>
                              {attachment.summaryStatus === 'processing' || attachment.summaryStatus === 'pending' ? (
                                <span className="flex items-center gap-1 text-xs text-blue-400">
                                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                  Generating...
                                </span>
                              ) : attachment.summaryStatus === 'complete' ? (
                                <span className="flex items-center gap-1 text-xs text-green-400">
                                  <span className="material-symbols-outlined text-sm">check_circle</span>
                                  Complete
                                </span>
                              ) : attachment.summaryStatus === 'failed' ? (
                                <span className="flex items-center gap-1 text-xs text-red-400">
                                  <span className="material-symbols-outlined text-sm">error</span>
                                  Failed
                                </span>
                              ) : attachment.summaryStatus === 'cancelled' ? (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <span className="material-symbols-outlined text-sm">cancel</span>
                                  Cancelled
                                </span>
                              ) : null}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1">
                              {(attachment.summaryStatus === 'processing' || attachment.summaryStatus === 'pending') && noteId && (
                                <button
                                  onClick={() => onCancelSummary(attachment.id, noteId)}
                                  className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors flex items-center gap-1"
                                  title="Cancel summary generation"
                                >
                                  <span className="material-symbols-outlined text-sm">stop</span>
                                  Cancel
                                </button>
                              )}
                              {(attachment.summaryStatus === 'failed' || attachment.summaryStatus === 'cancelled' || attachment.summaryStatus === 'complete') && noteId && (
                                <button
                                  onClick={() => onRegenerateSummary(attachment.id, noteId)}
                                  className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition-colors flex items-center gap-1"
                                  title="Regenerate summary"
                                >
                                  <span className="material-symbols-outlined text-sm">refresh</span>
                                  Regenerate
                                </button>
                              )}
                            </div>
                          </div>

                          {attachment.summary ? (
                            <p className="text-sm text-gray-300 leading-relaxed">
                              {attachment.summary}
                            </p>
                          ) : attachment.summaryStatus === 'failed' ? (
                            <p className="text-sm text-red-400/70 italic">
                              Failed to generate summary
                            </p>
                          ) : attachment.summaryStatus === 'cancelled' ? (
                            <p className="text-sm text-gray-400/70 italic">
                              Summary generation was cancelled
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              Summary is being generated...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Lightbox Overlay */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={lightboxImage}
              alt="Full screen"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
};

export default RichTextEditor;