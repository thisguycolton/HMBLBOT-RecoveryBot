// The site's own pages: the privacy policy (/privacy) and the contact form (/contact).
// Each view renders <div id="site-page" data-page="privacy|contact" data-props="{...}">.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import PrivacyPage from "../components/site/PrivacyPage";
import ContactPage from "../components/site/ContactPage";

const PAGES = { privacy: PrivacyPage, contact: ContactPage };

const root = document.getElementById("site-page");
const Page = root && PAGES[root.dataset.page];
if (Page) {
  const props = JSON.parse(root.dataset.props || "{}");
  createRoot(root).render(
    <Layout isAuthenticated={document.body.dataset.currentUser === "true"}>
      <Page {...props} />
    </Layout>
  );
}
