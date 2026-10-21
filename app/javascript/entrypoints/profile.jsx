// Your profile at /users/edit (app/controllers/profiles_controller.rb)
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import ProfilePage from "../components/profile/ProfilePage";

const mount = document.getElementById("profile-root");
if (mount) {
  createRoot(mount).render(
    <Layout isAuthenticated>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <ProfilePage />
      </div>
    </Layout>
  );
}
