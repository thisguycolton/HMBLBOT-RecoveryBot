// app/javascript/entrypoints/topicificator.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import TopicificatorApp from "../components/TopicificatorApp";
import "../styles/tailwind.css";
import "../styles/reader.css";
import ChapterEditor from "../components/ChapterEditor";
import ChapterViewer from "../components/ChapterViewer";
import ChapterAdmin from "../components/ChapterAdmin";
import axios from "axios";

const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (csrf) {
  axios.defaults.headers.common['X-CSRF-Token'] = csrf;
}
axios.defaults.headers.common['Accept'] = 'application/json';


const container = document.getElementById("topicificator-root");
if (container) {
  createRoot(container).render(<TopicificatorApp />);
}

const mount = document.getElementById("chapter-viewer");
if (mount) {
  // Primary: data attributes
  let bookSlug = mount.dataset.bookSlug;
  let chapterSlug = mount.dataset.chapterSlug;

  // Fallback A: try to infer from URL /books/:book_slug/chapters/:slug
  if (!bookSlug) {
    const m = location.pathname.match(/\/books\/([^/]+)\/chapters\/([^/]+)/);
    if (m) {
      bookSlug = m[1];
      chapterSlug = chapterSlug || m[2];
    }
  }

  // Fallback B: allow meta tag or global if you want
  if (!bookSlug) {
    const meta = document.querySelector('meta[name="hb:book-slug"]');
    if (meta) bookSlug = meta.content;
  }

  console.log("[mount ChapterViewer]", { bookSlug, chapterSlug });

  if (!bookSlug || !chapterSlug) {
    console.error("Missing bookSlug or chapterSlug for ChapterViewer", { bookSlug, chapterSlug });
  } else {
    createRoot(mount).render(<ChapterViewer bookSlug={bookSlug} slug={chapterSlug} />);
  }
}
const edit = document.getElementById("chapter-editor");
if (edit) {
  const bookSlug = edit.dataset.bookSlug;
  const slug = edit.dataset.chapterSlug;
  createRoot(edit).render(<ChapterEditor bookSlug={bookSlug} slug={slug} />);
}

const admin = document.getElementById("chapter-admin");
if (admin) {
  const bookSlug = admin.dataset.bookSlug;
  const slug = admin.dataset.chapterSlug;
  createRoot(admin).render(<ChapterAdmin bookSlug={bookSlug} slug={slug} />);
}