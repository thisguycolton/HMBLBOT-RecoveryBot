// The admin suite (User#suite_admin? only). Mounted by app/views/admin_panel/suite/show.html.erb.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import AdminSuite from "../components/admin_suite/App";

const root = document.getElementById("admin-suite");
if (root) {
  createRoot(root).render(
    <Layout isAuthenticated={document.body.dataset.currentUser === "true"} showFooter={false}>
      <AdminSuite />
    </Layout>
  );
}
