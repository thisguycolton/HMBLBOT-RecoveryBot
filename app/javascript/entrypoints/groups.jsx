// Groups at /groups (app/controllers/groups_controller.rb): your groups, a group's page
// with its meetings, readings, literature, members and court verifications, and
// "Find your group".
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Navbar from "../components/Navbar";
import GroupsIndex from "../components/groups/GroupsIndex";
import GroupForm from "../components/groups/GroupForm";
import GroupPage from "../components/groups/GroupPage";
import FindGroup from "../components/groups/FindGroup";

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
        { index: true, element: <GroupsIndex /> },
        { path: "new", element: <GroupForm /> },
        { path: "find", element: <FindGroup /> },
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
