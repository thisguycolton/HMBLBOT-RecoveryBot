import React from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  useRouteError,
  Outlet,
} from "react-router-dom";

import Navbar from "../components/Navbar";
import BooksIndex from "../components/book/BooksIndex";
import BookEdit from "../components/book/BookEdit";
import ChapterViewer from "../components/ChapterViewer";

import "../styles/tailwind.css";
import "../styles/reader.css";

const body = document.body;
const isAuthenticated = body.dataset.currentUser === "true";

function ErrorBoundary() {
  const err = useRouteError();
  return (
    <div className="mx-auto max-w-2xl p-6 text-red-600">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <pre className="mt-3 text-sm whitespace-pre-wrap">
        {err?.statusText || err?.message || String(err)}
      </pre>
      <Link className="underline" to="/">Back to Library</Link>
    </div>
  );
}

function LibraryShell() {
  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="pt-[var(--nav-h,56px)]">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </>
  );
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <LibraryShell />,
      errorElement: <ErrorBoundary />,
      children: [
        { index: true, element: <BooksIndex /> },
        { path: ":slug/edit", element: <BookEdit /> },

        // If you actually want to render a reader here, ChapterViewer needs route params.
        // For now you can remove this route until you wire it properly:
        // { path: ":slug", element: <ChapterViewer /> },
      ],
    },
  ],
  { basename: "/library" }
);

const mount = document.getElementById("books-root");
if (mount) {
  const key = "__books_root__";
  const existing = window[key];
  const root = existing?.el === mount ? existing.root : createRoot(mount);
  window[key] = { root, el: mount };

  root.render(<RouterProvider router={router} />);
}