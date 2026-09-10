'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  content,
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose max-w-none p-4 min-h-[180px] focus:outline-none text-sm text-gray-800 leading-relaxed',
      },
    },
  });

  if (!editor) {
    return (
      <div className="border rounded-md p-4 min-h-[180px] bg-gray-50 animate-pulse text-xs text-gray-400">
        Memuat editor materi...
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-[#002446] focus-within:border-transparent transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('bold') ? 'bg-[#002446] text-white' : 'text-gray-600'
          }`}
          title="Tebal (Bold)"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('italic') ? 'bg-[#002446] text-white' : 'text-gray-600'
          }`}
          title="Miring (Italic)"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('strike') ? 'bg-[#002446] text-white' : 'text-gray-600'
          }`}
          title="Coret (Strikethrough)"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-[#002446] text-white'
              : 'text-gray-600'
          }`}
          title="Judul 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-[#002446] text-white'
              : 'text-gray-600'
          }`}
          title="Judul 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('bulletList')
              ? 'bg-[#002446] text-white'
              : 'text-gray-600'
          }`}
          title="Daftar Poin"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('orderedList')
              ? 'bg-[#002446] text-white'
              : 'text-gray-600'
          }`}
          title="Daftar Angka"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-8 w-8 p-0 ${
            editor.isActive('blockquote')
              ? 'bg-[#002446] text-white'
              : 'text-gray-600'
          }`}
          title="Kutipan"
        >
          <Quote className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0 text-gray-600"
          title="Garis Pemisah"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-gray-300 mx-1 ml-auto" />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0 text-gray-600 disabled:opacity-30"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0 text-gray-600 disabled:opacity-30"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Body */}
      <EditorContent editor={editor} />
    </div>
  );
}
