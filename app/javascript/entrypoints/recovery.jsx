// A member's own recovery tools at /recovery (app/controllers/recovery_controller.rb): their
// chips, the nightly 10th step and gratitude lists (only ever their own, unless they send one
// to their sponsor), their sponsors and sponsees, and giving chips for a group they host for.
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import { registerRouter } from "../components/shell/useShell";
import ChipsPage from "../components/recovery/ChipsPage";
import InventoryPage from "../components/recovery/InventoryPage";
import GratitudePage from "../components/recovery/GratitudePage";
import GivePage from "../components/recovery/GivePage";
import SponsorshipPage from "../components/recovery/SponsorshipPage";

function Shell() {
  return (
    <Layout isAuthenticated>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </div>
    </Layout>
  );
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Shell />,
      children: [
        { index: true, element: <ChipsPage /> },
        { path: "inventory", element: <InventoryPage /> },
        { path: "inventory/:on", element: <InventoryPage /> },
        { path: "gratitude", element: <GratitudePage /> },
        { path: "gratitude/:on", element: <GratitudePage /> },
        { path: "give", element: <GivePage /> },
        { path: "sponsorship", element: <SponsorshipPage /> },
        { path: "sponsorship/:id", element: <SponsorshipPage /> },
      ],
    },
  ],
  { basename: "/recovery" }
);
// The sidebar's links into this app move without a load
registerRouter(router, "/recovery");

const mount = document.getElementById("recovery-root");
if (mount) createRoot(mount).render(<RouterProvider router={router} />);
