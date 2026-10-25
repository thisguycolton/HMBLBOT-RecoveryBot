import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useShellContext } from "./useShell";

// A page's side panel: what sits beside the stage on wide screens (the home feed's Today),
// and on phones a sheet behind the panel button in the bottom bar. Render it anywhere in the
// page; the shell (Layout.jsx) gives it its place.
export default function PageAside({ title, children }) {
  const { asideTarget, setAside } = useShellContext();
  useEffect(() => {
    setAside({ title });
    return () => setAside(null);
  }, [title, setAside]);
  return asideTarget ? createPortal(children, asideTarget) : null;
}
