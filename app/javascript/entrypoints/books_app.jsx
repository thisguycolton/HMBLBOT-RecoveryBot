import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  useRouteError,
} from "react-router-dom";
import BooksIndex from "../components/book/BooksIndex";
import BookEdit from "../components/book/BookEdit";
import Navbar from "../components/Navbar";

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
      <Link className="underline" to="/">Back to Books</Link>
    </div>
  );
}

// IMPORTANT: set the basename so your routes are relative to /library
const router = createBrowserRouter(
  [
    { path: "/", element: <BooksIndex />, errorElement: <ErrorBoundary /> },
    { path: "/:slug/edit", element: <BookEdit />, errorElement: <ErrorBoundary /> },
  ],
  { basename: "/library" }
);

const mount = document.getElementById("books-root");
if (mount) {
  createRoot(mount).render(
    <>
    <Navbar isAuthenticated={isAuthenticated} />
    
    <RouterProvider router={router} className="mx-auto" />
    </>
);
}