import { useEffect, useState, useRef, MouseEvent } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { FontFamily } from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';
import Mathematics from '@tiptap/extension-mathematics';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import 'katex/dist/katex.min.css';
import ShapeOverlay from './ShapeOverlay';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ noteId, content, onChange, onTextSelect, editorRef, onTableActiveChange, attachments, onFileUpload, onAttachmentClick, onDeleteAttachment }) => {
  const [highlightColor, setHighlightColor] = useState('#ffc078');
  const [selectedFont, setSelectedFont] = useState('Inter');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteAttachmentConfirmation, setDeleteAttachmentConfirmation] = useState<Attachment | null>(null);

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

  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // Effect to handle internal ToC link clicks
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
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
    editorElement.addEventListener('click', handleClick);

    return () => {
      editorElement.removeEventListener('click', handleClick);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !onTextSelect) return;

    const handleSelectionChange = () => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');

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

  if (!editor) {
    return null;
  }

  const addShape = (type: 'box' | 'circle') => {
    const newShape: Shape = {
      id: `shape-${Date.now()}`,
      type,
      x: 100,
      y: 100,
      width: type === 'box' ? 200 : 150,
      height: type === 'box' ? 150 : 150,
      color: '#60a5fa',
      opacity: 0.3,
    };
    setShapes([...shapes, newShape]);
  };

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

  const handleDeleteConfirm = () => {
    if (deleteAttachmentConfirmation && noteId) {
      onDeleteAttachment(noteId, deleteAttachmentConfirmation.id);
    }
    setDeleteAttachmentConfirmation(null);
  };

  const handleExportPDF = async () => {
    if (!editor) return;

    // Create a container for the content
    const element = document.createElement('div');
    element.innerHTML = editor.getHTML();

    // Apply comprehensive PDF-friendly styling
    element.style.padding = '40px';
    element.style.fontFamily = 'Arial, Helvetica, sans-serif';
    element.style.color = '#000000';
    element.style.backgroundColor = '#ffffff';
    element.style.width = '210mm';
    element.style.minHeight = '297mm';
    element.style.lineHeight = '1.6';
    element.style.fontSize = '14px';

    // Style all child elements for PDF
    const allElements = element.querySelectorAll('*');
    allElements.forEach((el: any) => {
      // Remove dark backgrounds
      if (el.style.backgroundColor && el.style.backgroundColor !== 'transparent') {
        const bgColor = el.style.backgroundColor;
        // Only keep highlight colors, remove dark backgrounds
        if (!bgColor.includes('rgb(255') && !bgColor.includes('#ff') && !bgColor.includes('#f')) {
          el.style.backgroundColor = 'transparent';
        }
      }

      // Ensure text is black unless it's a specific color
      if (el.style.color) {
        const color = el.style.color;
        // Keep intentional colors, but convert white/light text to black
        if (color.includes('rgb(255, 255, 255)') || color.includes('#fff') || color.includes('white')) {
          el.style.color = '#000000';
        }
      }

      // Fix highlights - make them subtle and readable
      if (el.tagName === 'MARK') {
        el.style.backgroundColor = '#fff9c4'; // Light yellow
        el.style.color = '#000000';
        el.style.padding = '2px 0';
      }

      // Style code blocks
      if (el.tagName === 'PRE' || el.tagName === 'CODE') {
        el.style.backgroundColor = '#f5f5f5';
        el.style.border = '1px solid #ddd';
        el.style.padding = '12px';
        el.style.borderRadius = '4px';
        el.style.fontFamily = 'Courier New, monospace';
        el.style.fontSize = '12px';
        el.style.color = '#000000';
        el.style.whiteSpace = 'pre-wrap';
        el.style.wordBreak = 'break-word';
      }

      // Style math/KaTeX elements - ensure they are visible and black
      if (el.classList.contains('math-display') || el.classList.contains('math-inline') ||
        el.classList.contains('katex') || el.classList.contains('katex-display')) {
        el.style.color = '#000000';
        el.style.backgroundColor = 'transparent';
      }

      // Make sure SVG elements in math are visible
      if (el.tagName === 'SVG') {
        el.style.color = '#000000';
      }

      // Style headings
      if (el.tagName === 'H1') {
        el.style.fontSize = '24px';
        el.style.fontWeight = 'bold';
        el.style.marginTop = '20px';
        el.style.marginBottom = '12px';
        el.style.color = '#000000';
      }
      if (el.tagName === 'H2') {
        el.style.fontSize = '20px';
        el.style.fontWeight = 'bold';
        el.style.marginTop = '16px';
        el.style.marginBottom = '10px';
        el.style.color = '#000000';
      }
      if (el.tagName === 'H3') {
        el.style.fontSize = '16px';
        el.style.fontWeight = 'bold';
        el.style.marginTop = '14px';
        el.style.marginBottom = '8px';
        el.style.color = '#000000';
      }

      // Style paragraphs
      if (el.tagName === 'P') {
        el.style.marginBottom = '12px';
        el.style.color = '#000000';
      }

      // Style tables
      if (el.tagName === 'TABLE') {
        el.style.borderCollapse = 'collapse';
        el.style.width = '100%';
        el.style.marginBottom = '16px';
      }
      if (el.tagName === 'TD' || el.tagName === 'TH') {
        el.style.border = '1px solid #ddd';
        el.style.padding = '8px';
        el.style.color = '#000000';
      }
      if (el.tagName === 'TH') {
        el.style.backgroundColor = '#f5f5f5';
        el.style.fontWeight = 'bold';
      }

      // Style lists
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        el.style.marginLeft = '20px';
        el.style.marginBottom = '12px';
      }
      if (el.tagName === 'LI') {
        el.style.marginBottom = '4px';
        el.style.color = '#000000';
      }
    });

    // Position element visibly but off-scroll for proper KaTeX rendering
    element.style.position = 'fixed';
    element.style.top = '0';
    element.style.left = '0';
    element.style.zIndex = '9999';
    element.style.overflow = 'auto';
    element.style.maxHeight = '100vh';

    // Add semi-transparent overlay to show export is in progress
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '9998';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = 'white';
    overlay.style.fontSize = '20px';
    overlay.innerHTML = '<div>Generating PDF... Please wait</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(element);

    try {
      // Wait for KaTeX to fully render
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Convert HTML to canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('my-note.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Failed to export PDF. Please check the console for details.');
    } finally {
      // Remove temporary elements
      document.body.removeChild(element);
      document.body.removeChild(overlay);
    }
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
            className={`w-9 h-9 flex items-center justify-center rounded-md text-sm font-bold transition-all duration-150 ${editor.isActive('bold')
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Bold (Ctrl+B)"
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`w-9 h-9 flex items-center justify-center rounded-md text-sm italic transition-all duration-150 ${editor.isActive('italic')
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`w-9 h-9 flex items-center justify-center rounded-md text-sm underline transition-all duration-150 ${editor.isActive('underline')
              ? 'bg-pink-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Underline (Ctrl+U)"
          >
            U
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Headings */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`w-9 h-8 flex items-center justify-center rounded-md text-[10px] font-bold transition-all duration-150 ${editor.isActive('heading', { level: 1 })
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`w-9 h-8 flex items-center justify-center rounded-md text-[10px] font-bold transition-all duration-150 ${editor.isActive('heading', { level: 2 })
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`w-9 h-8 flex items-center justify-center rounded-md text-[10px] font-bold transition-all duration-150 ${editor.isActive('heading', { level: 3 })
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
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
            className={`w-9 h-8 flex items-center justify-center rounded-md text-lg transition-all duration-150 ${editor.isActive('bulletList')
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`w-9 h-8 flex items-center justify-center rounded-md text-sm font-semibold transition-all duration-150 ${editor.isActive('orderedList')
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-400 hover:bg-dark-700/80 hover:text-white'
              }`}
            title="Numbered List"
          >
            1.
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Table */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={insertTable}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Insert Table"
          >
            <span className="material-symbols-outlined text-base">table</span>
          </button>
        </div>

        <div className="w-px h-6 bg-dark-600/50"></div>

        {/* Shapes */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => addShape('box')}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Add Box"
          >
            <span className="material-symbols-outlined text-base">rectangle</span>
          </button>
          <button
            onClick={() => addShape('circle')}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Add Circle"
          >
            <span className="material-symbols-outlined text-base">circle</span>
          </button>
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

        {/* Export PDF */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleExportPDF}
            className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 text-gray-400 hover:bg-dark-700/80 hover:text-white"
            title="Export to PDF"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div>
        <EditorContent editor={editor} />
        {/* Attachments display area */}
        {attachments.length > 0 && (
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
                    <span>{attachment.filename}</span>
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
        )}
      </div>

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
    </div>
  );
};
export default RichTextEditor;