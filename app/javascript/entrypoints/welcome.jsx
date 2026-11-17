// The welcome wizard a new account sees once after signing in (/welcome, WelcomeController):
// <div id="welcome-page" data-props="{...}">.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import WelcomeWizard from "../components/welcome/WelcomeWizard";

const root = document.getElementById("welcome-page");
if (root) {
  const props = JSON.parse(root.dataset.props || "{}");
  createRoot(root).render(
    <Layout isAuthenticated bottomBar={false} showFooter={false}>
      <WelcomeWizard {...props} />
    </Layout>
  );
}
