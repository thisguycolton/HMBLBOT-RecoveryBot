// Schedule polls at /schedule_polls (app/controllers/schedule_polls_controller.rb):
// the list, new and edit pages for organizers, and the public voting page.
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Navbar from "../components/Navbar";
import PollsIndex from "../components/schedule_polls/PollsIndex";
import PollForm from "../components/schedule_polls/PollForm";
import PollPage from "../components/schedule_polls/PollPage";

const isAuthenticated = document.body.dataset.currentUser === "true";

function Shell() {
  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="w-full pt-[var(--nav-h,56px)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
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
      element: <Shell />,
      children: [
        { index: true, element: <PollsIndex /> },
        { path: "new", element: <PollForm /> },
        { path: ":token", element: <PollPage /> },
        { path: ":token/edit", element: <PollForm /> },
      ],
    },
  ],
  { basename: "/schedule_polls" }
);

const mount = document.getElementById("schedule-polls-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
