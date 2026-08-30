// app/javascript/entrypoints/topicificator.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import TopicificatorApp from "../components/TopicificatorApp";
import ChapterEditor from "../components/ChapterEditor";
import ChapterViewer from "../components/ChapterViewer";
import ChapterAdmin from "../components/ChapterAdmin";
import ReadingArchive from "../components/ReadingArchive";
import ReadingEditor from "../components/ReadingEditor";
import ReadingShow from "../components/ReadingShow";
import HomePage from "../components/HomePage";
import CourtVerificationForm from "../components/CourtVerificationForm";
import ScratchPaper from "../components/ScratchPaper";
import ServiceReadingsIndex from "../components/ServiceReadingsIndex";
import ServiceReadingShow from "../components/ServiceReadingShow";
import Layout from "../components/Layout";



// ---- shared flags/config ----
const body = document.body;
const isAuthenticated = body.dataset.currentUser === "true";

mountReact("topicificator-root", () => (
  <>
    <Navbar isAuthenticated={isAuthenticated} />
    <TopicificatorApp />
  </>
));

const csrf = document
  .querySelector('meta[name="csrf-token"]')
  ?.getAttribute("content");

if (csrf) axios.defaults.headers.common["X-CSRF-Token"] = csrf;
axios.defaults.headers.common["Accept"] = "application/json";

// ---- createRoot() guard (prevents double-mount warnings) ----
function mountReact(id, renderFn) {
  const el = document.getElementById(id);
  if (!el) return;

  const key = `__root_${id}__`;
  const existing = window[key];
  const root = existing?.el === el ? existing.root : createRoot(el);
  window[key] = { root, el };

  root.render(renderFn(el));
}


// ---------------- Chapter Viewer ----------------
mountReact("chapter-viewer", (mount) => {
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

  if (!bookSlug || !chapterSlug) {
    console.error("Missing bookSlug or chapterSlug for ChapterViewer", {
      bookSlug,
      chapterSlug,
    });
    return (
      <>
        <Navbar isAuthenticated={isAuthenticated} />
        <div className="p-6 text-red-600">Missing book or chapter.</div>
      </>
    );
  }

  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="pt-[var(--nav-h,56px)] prose-headings:my-1 md:prose-headings:my-2 xl:prose-headings:my-2 prose-p:my-0 md:prose-p:my-1 xl:prose-p:my-1">
        <ChapterViewer bookSlug={bookSlug} slug={chapterSlug} className="pt-16" />
      </main>
    </>
  );
});

// ---------------- Chapter Editor ----------------
mountReact("chapter-editor", (edit) => {
  const bookSlug = edit.dataset.bookSlug;
  const slug = edit.dataset.chapterSlug;

  return (
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
});

// ---------------- Chapter Admin ----------------
mountReact("chapter-admin", (admin) => (
  <ChapterAdmin bookSlug={admin.dataset.bookSlug} slug={admin.dataset.chapterSlug} />
));

// ---------------- Court Verification ----------------
mountReact("court-verification-root", () => (
  <>
  <Navbar isAuthenticated={isAuthenticated} />
  <CourtVerificationForm />
  </>
));

// ---------------- Reading Archive ----------------
mountReact("reading-archive-root", (rootEl) => {
  const readings = JSON.parse(rootEl.dataset.readings || "[]");
  const notice = rootEl.dataset.notice || "";

  return (
    <Layout isAuthenticated={isAuthenticated}>
      <ReadingArchive readings={readings} notice={notice} />
    </Layout>
  );
});

// ---------------- Reading Editor ----------------
mountReact("reading-editor-root", (rootEl) => {
  const reading = JSON.parse(rootEl.dataset.reading || "{}");
  const currentUser = JSON.parse(rootEl.dataset.currentUser || "null");
  const tags = JSON.parse(rootEl.dataset.tags || "[]");

  return (
    <>
    <Navbar isAuthenticated={isAuthenticated} />
    <ReadingEditor
      reading={reading}
      currentUser={currentUser}
      tags={tags}
    />
    </>
  );
});

// ---------------- Reading Show ----------------
mountReact("reading-show-root", (rootEl) => {
  const reading = JSON.parse(rootEl.dataset.reading || "{}");
  const notice = rootEl.dataset.notice || "";
  const currentUser = JSON.parse(rootEl.dataset.currentUser || "null");


  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <ReadingShow reading={reading} notice={notice} currentUser={currentUser}/>
    </>
  );
});

// ---------------- Scratch Paper ----------------
mountReact("scratchpaper-root", () => (
  <Layout isAuthenticated={isAuthenticated}>
    <ScratchPaper />
  </Layout>
));

// ---------------- Service Readings Index ----------------
mountReact("service-readings-root", (rootEl) => {
  const serviceReadings = JSON.parse(rootEl.dataset.serviceReadings || "[]");
  const isAdmin = rootEl.dataset.isAdmin === "true";

  return (
    <Layout isAuthenticated={isAuthenticated}>
      <ServiceReadingsIndex
        serviceReadings={serviceReadings}
        isAdmin={isAdmin}
      />
    </Layout>
  );
});

// ---------------- Service Reading Show ----------------

mountReact("service-reading-show-root", (el) => {
  const reading = JSON.parse(el.dataset.reading || "{}");
  const notice = el.dataset.notice || "";
  const isAdmin = el.dataset.admin === "true";

  return (
    <Layout isAuthenticated={isAuthenticated}>
      <ServiceReadingShow
        reading={reading}
        notice={notice}
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
      />
    </Layout>
  );
});

// ---------------- Home Page (Landing) ----------------
mountReact("home-root", () => (
  <Layout isAuthenticated={isAuthenticated}>
    <HomePage />
  </Layout>
));