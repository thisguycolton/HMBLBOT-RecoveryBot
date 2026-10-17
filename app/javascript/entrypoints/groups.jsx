// Groups at /groups (app/controllers/groups_controller.rb): your groups, a group's page
// (made in the HMBLBOT Editor at /groups/:slug/page/edit) with its meetings, readings,
// literature, members and court verifications, "Find your group" with the pages of AA
// Intergroup groups that aren't here yet, and the default page they show. Your timeline
// is on your profile (entrypoints/people.jsx).
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";
import "../styles/events.css";
import "../styles/writebook.css";

import Navbar from "../components/Navbar";
import GroupsIndex from "../components/groups/GroupsIndex";
import GroupForm from "../components/groups/GroupForm";
import GroupPage from "../components/groups/GroupPage";
import FindGroup from "../components/groups/FindGroup";
import IntergroupPage from "../components/groups/page/IntergroupPage";
import GroupPageEditor from "../components/groups/page/GroupPageEditor";

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
    // The HMBLBOT Editor takes the whole window
    { path: "/default-page/edit", element: <div className="ev-root w-full"><GroupPageEditor template /></div> },
    { path: "/:slug/page/edit", element: <div className="ev-root w-full"><GroupPageEditor /></div> },
    {
      path: "/",
      element: <Shell />,
      children: [
        { index: true, element: <GroupsIndex /> },
        { path: "new", element: <GroupForm /> },
        { path: "find", element: <FindGroup /> },
        { path: "find/:oiaaSlug", element: <IntergroupPage /> },
        { path: "default-page", element: <IntergroupPage template /> },
        { path: ":slug", element: <GroupPage /> },
        { path: ":slug/:tab", element: <GroupPage /> },
        { path: ":slug/edit", element: <GroupForm /> },
      ],
    },
  ],
  { basename: "/groups" }
);

const mount = document.getElementById("groups-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
