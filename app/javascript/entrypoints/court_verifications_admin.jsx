// Court verifications lookup (admins only). Mounted by
// app/views/admin_panel/court_verifications/index.html.erb.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import CourtVerificationsAdmin from "../components/court_verifications_admin/App";

const root = document.getElementById("court-verifications-admin");
if (root) {
  createRoot(root).render(
    <Layout isAuthenticated={document.body.dataset.currentUser === "true"} showFooter={false}>
      <CourtVerificationsAdmin />
    </Layout>
  );
}
