import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({
  children,
  isAuthenticated,
  showFooter = true,
  hideDonate = false,
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isAuthenticated={isAuthenticated} hideDonate={hideDonate} />

      <main className="flex-grow pt-[var(--nav-h,56px)]">
        {children}
      </main>

      {showFooter && <Footer />}
    </div>
  );
}