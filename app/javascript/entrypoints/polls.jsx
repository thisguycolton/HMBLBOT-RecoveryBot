// Polls (app/controllers/polls_controller.rb): the list, new and edit pages for the people who
// run them, and the public voting page at the short link /p/:token (also /polls/:token).
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import PollsIndex from "../components/polls/PollsIndex";
import PollForm from "../components/polls/PollForm";
import PollPage from "../components/polls/PollPage";

const isAuthenticated = document.body.dataset.currentUser === "true";

function Shell() {
  return (
    <Layout isAuthenticated={isAuthenticated}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </div>
    </Layout>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { path: "polls", element: <PollsIndex /> },
      { path: "polls/new", element: <PollForm /> },
      { path: "polls/:token", element: <PollPage /> },
      { path: "polls/:token/edit", element: <PollForm /> },
      { path: "p/:token", element: <PollPage /> },
    ],
  },
]);

const mount = document.getElementById("polls-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
