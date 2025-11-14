import React, { useRef, useState } from "react";

function getCsrf() {
  const m = document.querySelector('meta[name="csrf-token"]');
  return m?.content || "";
}

export default function AdminJsonUploader() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);
  const textRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      let jsonText = textRef.current?.value?.trim() || "";

      if (!jsonText && fileRef.current?.files?.[0]) {
        const buf = await fileRef.current.files[0].text();
        jsonText = buf.trim();
      }

      if (!jsonText) {
        setMsg("Please choose a JSON file or paste JSON.");
        setBusy(false);
        return;
      }

      // basic sanity check
      JSON.parse(jsonText);

      const res = await fetch("/api/books/import_json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrf(),
          "Accept": "application/json",
        },
        body: JSON.stringify({ payload: jsonText }),
        credentials: "same-origin",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(data.error || "Upload failed.");
      } else {
        setMsg(`Imported: ${data.book?.title || "Book"} (${data.created_chapters} new / ${data.updated_chapters} updated)`);
        // optional: refresh list
        window.dispatchEvent(new CustomEvent("books:refresh"));
      }
    } catch (err) {
      setMsg(`Invalid JSON: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}
      className="flex items-start gap-3 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50">
      <div className="flex flex-col gap-2 w-full">
        <div className="text-sm font-semibold">Admin: Import Book JSON</div>
        <div className="flex gap-3">
          <input type="file" accept="application/json" ref={fileRef}
                 className="block text-sm" />
          <button disabled={busy}
            className="px-3 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
        <div className="text-xs text-slate-500">or paste JSON:</div>
        <textarea ref={textRef} rows={6}
          placeholder='{"title":"…","author":"…","slug":"…","chapters":[{"title":"…","slug":"…","position":1,"tiptap_json":{…}}]}'
          className="w-full rounded-md border border-slate-200 dark:border-slate-800 p-2 text-sm bg-white dark:bg-slate-900" />
        {msg && <div className="text-sm mt-1">{msg}</div>}
      </div>
    </form>
  );
}