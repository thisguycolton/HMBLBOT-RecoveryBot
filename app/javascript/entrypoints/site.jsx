// The site's own pages: the privacy policy (/privacy), the terms of use (/terms), the contact
// form (/contact), getting the app (/install) and a group's 7th Tradition page (/g/CODE). Each view renders <div id="site-page" data-page="privacy|terms|contact|install|give" data-props="{...}">.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import PrivacyPage from "../components/site/PrivacyPage";
import TermsPage from "../components/site/TermsPage";
import ContactPage from "../components/site/ContactPage";
import InstallPage from "../components/site/InstallPage";
import GivePage from "../components/site/GivePage";

const PAGES = { privacy: PrivacyPage, terms: TermsPage, contact: ContactPage, install: InstallPage, give: GivePage };

const root = document.getElementById("site-page");
const Page = root && PAGES[root.dataset.page];
if (Page) {
  const props = JSON.parse(root.dataset.props || "{}");
  createRoot(root).render(
    <Layout isAuthenticated={document.body.dataset.currentUser === "true"} showFooter={Page !== GivePage} hideDonate={Page === GivePage}>
      <Page {...props} />
    </Layout>
  );
}
