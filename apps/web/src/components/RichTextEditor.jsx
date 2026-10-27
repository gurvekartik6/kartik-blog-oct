import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Undo, Redo, Image as ImageIcon } from 'lucide-react';

export default function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
      Image.configure({ inline: false, allowBase64: false })
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        'aria-label': 'Article content editor'
      }
    }
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '<p></p>', false);
  }, [value, editor]);
  if (!editor) return <div className="editor-loading">Loading editor…</div>;
  const setLink = () => {
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter a URL', previous);
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };
  const setImage = () => {
    const url = window.prompt('Enter the image URL from your Media library');
    if (url === null || !url.trim()) return;
    const alt = window.prompt('Describe the image for accessibility', '') || '';
    editor.chain().focus().setImage({ src: url.trim(), alt }).run();
  };
  const controls = [
    ['Bold', <Bold size={16}/>, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['Italic', <Italic size={16}/>, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['Heading 2', <Heading2 size={16}/>, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 })],
    ['Heading 3', <Heading3 size={16}/>, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 })],
    ['Bulleted list', <List size={16}/>, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
    ['Numbered list', <ListOrdered size={16}/>, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
    ['Quote', <Quote size={16}/>, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote')],
    ['Link', <Link2 size={16}/>, setLink, editor.isActive('link')],
    ['Image', <ImageIcon size={16}/>, setImage, editor.isActive('image')],
    ['Undo', <Undo size={16}/>, () => editor.chain().focus().undo().run(), false],
    ['Redo', <Redo size={16}/>, () => editor.chain().focus().redo().run(), false]
  ];
  return <div className="rich-editor">
    <div className="editor-toolbar">{controls.map(([label, icon, action, active]) => <button type="button" title={label} aria-label={label} className={active ? 'active' : ''} onClick={action} key={label}>{icon}</button>)}</div>
    <EditorContent editor={editor}/>
    <div className="editor-help">Use headings to structure your story. Images can be uploaded in Media and inserted by URL.</div>
  </div>;
}
