// Events at /events/:token (app/controllers/events_controller.rb): the event page, and the
// HMBLBOT Editor at /events/:token/edit.
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";
import "../styles/events.css";

import Layout from "../components/Layout";
import EventPage from "../components/events/EventPage";
import EventEditor from "../components/events/editor/EventEditor";

const isAuthenticated = document.body.dataset.currentUser === "true";

function PageShell() {
  return (
    <div className="ev-root w-full">
      <Layout isAuthenticated={isAuthenticated}>
        <Outlet />
      </Layout>
    </div>
  );
}

const router = createBrowserRouter(
  [
    { path: "/:token/edit", element: <div className="ev-root w-full"><EventEditor /></div> },
    { path: "/:token", element: <PageShell />, children: [{ index: true, element: <EventPage /> }] },
  ],
  { basename: "/events" }
);

const mount = document.getElementById("events-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
