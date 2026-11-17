import { useEffect } from "react";

// While a page is open, printing shows only its own printable part (see documents.css): the
// site's menu and the group's header and tabs stay out of the paper copy
export default function usePrintable() {
  useEffect(() => {
    document.body.classList.add("doc-printing");
    return () => document.body.classList.remove("doc-printing");
  }, []);
}

// Prints with the page's title as the file name Save as PDF suggests
export function printTitled(title) {
  const before = document.title;
  document.title = title;
  const restore = () => { document.title = before; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
}
