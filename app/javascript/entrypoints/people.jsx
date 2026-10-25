// Profiles at /people (app/controllers/people_controller.rb): someone's page (made in the
// HMBLBOT Editor at /people/me/edit) with their notes and highlights, and People, with
// what the people you follow share, and a #hashtag's notes (/people/tags/:tag).
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";
import "../styles/events.css";
import "../styles/writebook.css";

import Layout from "../components/Layout";
import PeopleIndex from "../components/people/PeopleIndex";
import ProfilePage from "../components/people/ProfilePage";
import ProfileEditor from "../components/people/ProfileEditor";
import HashtagPage from "../components/people/HashtagPage";

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

const router = createBrowserRouter(
  [
    // The HMBLBOT Editor takes the whole window
    { path: "/me/edit", element: <div className="ev-root w-full"><ProfileEditor /></div> },
    {
      path: "/",
      element: <Shell />,
      children: [
        { index: true, element: <PeopleIndex /> },
        { path: "tags/:tag", element: <HashtagPage /> },
        { path: ":username", element: <ProfilePage /> },
      ],
    },
  ],
  { basename: "/people" }
);

const mount = document.getElementById("people-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
