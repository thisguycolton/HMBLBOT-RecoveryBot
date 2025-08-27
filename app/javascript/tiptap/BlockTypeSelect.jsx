// BlockTypeSelect.jsx
import { ChevronDown } from "lucide-react";

const OPTIONS = [
  { id: "paragraph", label: "Paragraph", set: (e)=>e.chain().focus().setParagraph().run(), is: e=>e.isActive("paragraph") },
  { id: "h1", label: "Heading 1", set: (e)=>e.chain().focus().toggleHeading({level:1}).run(), is: e=>e.isActive("heading", {level:1}) },
  { id: "h2", label: "Heading 2", set: (e)=>e.chain().focus().toggleHeading({level:2}).run(), is: e=>e.isActive("heading", {level:2}) },
  { id: "h3", label: "Heading 3", set: (e)=>e.chain().focus().toggleHeading({level:3}).run(), is: e=>e.isActive("heading", {level:3}) },
  { id: "blockquote", label: "Quote", set: (e)=>e.chain().focus().toggleBlockquote().run(), is: e=>e.isActive("blockquote") },
  { id: "bulletList", label: "Bulleted list", set: (e)=>e.chain().focus().toggleBulletList().run(), is: e=>e.isActive("bulletList") },
  { id: "orderedList", label: "Numbered list", set: (e)=>e.chain().focus().toggleOrderedList().run(), is: e=>e.isActive("orderedList") },
  { id: "codeBlock", label: "Code block", set: (e)=>e.chain().focus().toggleCodeBlock().run(), is: e=>e.isActive("codeBlock") },
];

export default function BlockTypeSelect({ editor }) {
  if (!editor) return null;
  const active = OPTIONS.find(o => o.is(editor))?.label || "Paragraph";

  return (
    <div className="relative">
      <details className="group">
        <summary className="hb-btn inline-flex items-center gap-2 cursor-pointer list-none">
          {active}
          <ChevronDown size={14} className="opacity-60" />
        </summary>
        <div className="absolute z-50 mt-1 min-w-48 rounded border bg-white shadow">
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`block w-full text-left px-3 py-1.5 hover:bg-gray-50 ${opt.is(editor) ? "bg-gray-100 font-medium" : ""}`}
              onClick={() => opt.set(editor)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}