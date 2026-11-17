// The Docs (/docs, DocsController) and the About and History pages (/about, /history, which
// are docs pages with an alias): one React Router app, components/docs/.
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";
import "../components/docs/docs.css";

import { registerRouter } from "../components/shell/useShell";
import DocsApp from "../components/docs/DocsApp";
import DocsHome from "../components/docs/DocsHome";
import DocsSectionPage from "../components/docs/DocsSectionPage";
import DocPageView from "../components/docs/DocPageView";
import DocEditor from "../components/docs/DocEditor";

const mount = document.getElementById("docs-app");
const props = JSON.parse(mount?.dataset.props || "{}");

const router = createBrowserRouter([
  {
    path: "/",
    element: <DocsApp editor={!!props.editor} />,
    children: [
      { path: "docs", element: <DocsHome /> },
      { path: "docs/:section", element: <DocsSectionPage /> },
      { path: "docs/:section/:page", element: <DocPageView /> },
      { path: "docs/:section/:page/edit", element: <DocEditor /> },
      { path: "about", element: <DocPageView alias="about" /> },
      { path: "history", element: <DocPageView alias="history" /> },
    ],
  },
]);
// The sidebar's Help & docs link (and links inside a page) move without a load
registerRouter(router, "/docs");

if (mount) createRoot(mount).render(<RouterProvider router={router} />);
