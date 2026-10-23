// Groups at /groups (app/controllers/groups_controller.rb): your groups, a group's page
// (made in the HMBLBOT Editor at /groups/:slug/page/edit) with its meetings, readings,
// literature, members and court verifications, "Find your group" with the pages of AA
// Intergroup groups that aren't here yet, the default page they show, and "Find a meeting"
// (/groups/meetings) across all of them. Your timeline
// is on your profile (entrypoints/people.jsx).
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";
import "../styles/events.css";
import "../styles/writebook.css";
import "../styles/documents.css";

import Layout from "../components/Layout";
import GroupsIndex from "../components/groups/GroupsIndex";
import GroupForm from "../components/groups/GroupForm";
import GroupPage from "../components/groups/GroupPage";
import { ConscienceRoute } from "../components/groups/GroupDashboard";
import FindGroup from "../components/groups/FindGroup";
import FindMeeting from "../components/groups/FindMeeting";
import IntergroupPage from "../components/groups/page/IntergroupPage";
import GroupPageEditor from "../components/groups/page/GroupPageEditor";
import CommandCenter from "../components/groups/hosting/CommandCenter";
import DeckPage from "../components/groups/hosting/deck/DeckPage";
import GuestPostings from "../components/groups/hosting/GuestPostings";
import HostingIndex from "../components/groups/hosting/HostingIndex";
import ServiceReadingShare from "../components/groups/hosting/ServiceReadingShare";
import TimeCapsule from "../components/groups/hosting/TimeCapsule";

const isAuthenticated = document.body.dataset.currentUser === "true";

function Shell({ children }) {
  return (
    <Layout isAuthenticated={isAuthenticated}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {children || <Outlet />}
      </div>
    </Layout>
  );
}

const router = createBrowserRouter(
  [
    // The HMBLBOT Editor takes the whole window
    { path: "/default-page/edit", element: <div className="ev-root w-full"><GroupPageEditor template /></div> },
    { path: "/:slug/page/edit", element: <div className="ev-root w-full"><GroupPageEditor /></div> },
    // HostDeck (what was the Hosting Command Center) takes the whole window too
    { path: "/:slug/host/:meetingId", element: <CommandCenter /> },
    // A HostDeck of its own (a business meeting's, onboarding...), the whole window as well
    { path: "/:slug/decks/:deckId", element: <DeckPage /> },
    // A service reading on its own, to share that window in Zoom
    { path: "/:slug/share/service-reading/:id", element: <ServiceReadingShare /> },
    // What a hosting short link (/h/CODE) shows anyone else: the chat postings
    { path: "/:slug/chat/:code", element: <GuestPostings /> },
    // Group admins and members with a role get the group's dashboard; members the plain tab
    { path: "/:slug/conscience/*", element: <ConscienceRoute fallback={<Shell><GroupPage tab="conscience" /></Shell>} /> },
    {
      path: "/",
      element: <Shell />,
      children: [
        { index: true, element: <GroupsIndex /> },
        { path: "new", element: <GroupForm /> },
        { path: "find", element: <FindGroup /> },
        { path: "meetings", element: <FindMeeting /> },
        { path: "find/:oiaaSlug", element: <IntergroupPage /> },
        { path: "default-page", element: <IntergroupPage template /> },
        { path: ":slug", element: <GroupPage /> },
        { path: ":slug/host", element: <HostingIndex /> },
        { path: ":slug/host/capsule", element: <TimeCapsule /> },
        // One of the group's meetings, as a shared link opens it: the Meetings tab, that one picked out
        { path: ":slug/meetings/:meetingId", element: <GroupPage /> },
        { path: ":slug/:tab", element: <GroupPage /> },
        { path: ":slug/edit", element: <GroupForm /> },
      ],
    },
  ],
  { basename: "/groups" }
);

const mount = document.getElementById("groups-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
