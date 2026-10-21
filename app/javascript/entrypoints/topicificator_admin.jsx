// The Topicificator admin (admins only): topics, topic sets, categories, and ACID QUEST
// curation. Mounted by app/views/admin_panel/topicificator/show.html.erb.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import TopicificatorAdmin from "../components/topicificator_admin/App";

const root = document.getElementById("topicificator-admin");
if (root) {
  // the admin's own chrome (sidebar and top bar, like the admin suite) instead of the site nav
  createRoot(root).render(<TopicificatorAdmin />);
}
