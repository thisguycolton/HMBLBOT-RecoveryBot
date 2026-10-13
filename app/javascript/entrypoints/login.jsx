// The Devise login page (app/views/devise/sessions/new.html.erb).
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import LoginPage from "../components/auth/LoginPage";

const root = document.getElementById("login-page");
if (root) {
  const props = JSON.parse(root.dataset.props || "{}");
  createRoot(root).render(
    <Layout isAuthenticated={false} showFooter={false}>
      <LoginPage {...props} />
    </Layout>
  );
}
