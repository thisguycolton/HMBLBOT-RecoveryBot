// Devise's pages: log in, sign up, forgot password and change password.
// Each view renders <div id="auth-page" data-page="login|sign_up|forgot_password|reset_password" data-props="{...}">.
import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/tailwind.css";
import "../styles/reader.css";

import Layout from "../components/Layout";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from "../components/auth/AuthPages";

const PAGES = { login: LoginPage, sign_up: SignUpPage, forgot_password: ForgotPasswordPage, reset_password: ResetPasswordPage };

const root = document.getElementById("auth-page");
const Page = root && PAGES[root.dataset.page];
if (Page) {
  const props = JSON.parse(root.dataset.props || "{}");
  createRoot(root).render(
    <Layout isAuthenticated={false} showFooter={false}>
      <Page {...props} />
    </Layout>
  );
}
