import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useShellContext } from "./useShell";

// A page's side panel: what sits beside the stage on wide screens (the home feed's Today),
// and on phones a sheet behind the panel button in the bottom bar. Render it anywhere in the
// page; the shell (Layout.jsx) gives it its place. A `plain` panel brings its own cards, so
// the sheet doesn't put it on one.
export default function PageAside({ title, plain = false, children }) {
  const { asideTarget, setAside } = useShellContext();
  useEffect(() => {
    setAside({ title, plain });
    return () => setAside(null);
  }, [title, plain, setAside]);
  return asideTarget ? createPortal(children, asideTarget) : null;
}
