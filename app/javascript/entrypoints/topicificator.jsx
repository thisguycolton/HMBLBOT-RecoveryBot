// app/javascript/entrypoints/topicificator.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import TopicificatorApp from "../components/TopicificatorApp";
import "../styles/tailwind.css";
import "../styles/reader.css";
import ChapterEditor from "../components/ChapterEditor";
import ChapterViewer from "../components/ChapterViewer";
import ChapterAdmin from "../components/ChapterAdmin";
import ReadingArchive from "../components/ReadingArchive";
import Navbar from "../components/Navbar";
import CourtVerificationForm from "../components/CourtVerificationForm"; 
import axios from "axios";

const body = document.body;
const isAuthenticated = body.dataset.currentUser === "true";

const csrf = document
  .querySelector('meta[name="csrf-token"]')
  ?.getAttribute("content");
if (csrf) {
  axios.defaults.headers.common["X-CSRF-Token"] = csrf;
}
axios.defaults.headers.common["Accept"] = "application/json";

// ---------------- Topicificator ----------------
const container = document.getElementById("topicificator-root");
if (container) {
  createRoot(container).render(
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <TopicificatorApp />
    </>
  );
}

// ---------------- Chapter Viewer ----------------
const mount = document.getElementById("chapter-viewer");
if (mount) {
  let bookSlug = mount.dataset.bookSlug;
  let chapterSlug = mount.dataset.chapterSlug;

  if (!bookSlug) {
    const m = location.pathname.match(/\/books\/([^/]+)\/chapters\/([^/]+)/);
    if (m) {
      bookSlug = m[1];
      chapterSlug = chapterSlug || m[2];
    }
  }

  if (!bookSlug) {
    const meta = document.querySelector('meta[name="hb:book-slug"]');
    if (meta) bookSlug = meta.content;
  }

  console.log("[mount ChapterViewer]", { bookSlug, chapterSlug });

  if (!bookSlug || !chapterSlug) {
    console.error("Missing bookSlug or chapterSlug for ChapterViewer", {
      bookSlug,
      chapterSlug,
    });
  } else {
    createRoot(mount).render(
      <>
        <Navbar isAuthenticated={isAuthenticated} />
        <main className="pt-[var(--nav-h,56px)] prose-headings:my-1 md:prose-headings:my-2 xl:prose-headings:my-2 prose-p:my-0 md:prose-p:my-1 xl:prose-p:my-1">
          <ChapterViewer
            bookSlug={bookSlug}
            slug={chapterSlug}
            className="pt-16"
          />
        </main>
      </>
    );
  }
}

// ---------------- Chapter Editor ----------------
const edit = document.getElementById("chapter-editor");
if (edit) {
  const bookSlug = edit.dataset.bookSlug;
  const slug = edit.dataset.chapterSlug;
  createRoot(edit).render(
    <div
      className="
        prose prose-slate
        prose-sm md:prose lg:prose-lg xl:prose-xl
        dark:prose-invert
        max-w-none hb-reader
        mx-auto
        prose-headings:my-3 md:prose-headings:my-4 xl:prose-headings:my-4
        prose-p:my-2 md:prose-p:my-2 xl:prose-p:my-2
      "
    >
      <ChapterEditor bookSlug={bookSlug} slug={slug} />
    </div>
  );
}

// ---------------- Chapter Admin ----------------
const admin = document.getElementById("chapter-admin");
if (admin) {
  const bookSlug = admin.dataset.bookSlug;
  const slug = admin.dataset.chapterSlug;
  createRoot(admin).render(
    <ChapterAdmin bookSlug={bookSlug} slug={slug} />
  );
}

// ---------------- Court Verification ----------------
const verificationRoot = document.getElementById("court-verification-root");
if (verificationRoot) {
  createRoot(verificationRoot).render(
    <CourtVerificationForm isAuthenticated={isAuthenticated} />
  );
}

// ---------------- Reading Archive ----------------
const archiveRoot = document.getElementById("reading-archive-root");
if (archiveRoot) {
  const readings = JSON.parse(archiveRoot.dataset.readings || "[]");
  const notice = archiveRoot.dataset.notice || "";

  createRoot(archiveRoot).render(
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <ReadingArchive readings={readings} notice={notice} />
    </>
  );
}