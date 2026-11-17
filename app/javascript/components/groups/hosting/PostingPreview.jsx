import React, { useMemo } from "react";
import { postingHtml } from "./chatFormat";

// A chat posting as it will paste into the chat: its Markdown with the formatting shown. The HTML
// is built by chatFormat.js from escaped text and a few tags it writes itself.
export default function PostingPreview({ markdown, className = "" }) {
  const html = useMemo(() => postingHtml(markdown), [markdown]);
  return <div className={`hc-posting ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
