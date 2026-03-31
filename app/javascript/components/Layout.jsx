import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({ children, isAuthenticated }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex-grow pt-[var(--nav-h,56px)]">
        {children}
      </main>

      <Footer />
    </div>
  );
}