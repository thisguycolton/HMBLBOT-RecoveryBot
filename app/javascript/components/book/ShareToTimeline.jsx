import React from "react";
import axios from "axios";
import { Send } from "lucide-react";
import VisibilityPicker from "../notes/VisibilityPicker";
import { HIGHLIGHT_VISIBILITY, TIMELINE_AUDIENCES } from "../notes/lib";

// A highlight stays with its reader until they share it to their timeline: Share to
// timeline asks who sees it there (Followers or Members). Once it's shared, the same spot
// changes who sees it or takes it back off. Only once profiles are open to them.
// `iconOnly` fits a row of icon buttons (the Highlights page).
export default function ShareToTimeline({ highlight, onChange, toast, iconOnly = false, up = false }) {
  if (!highlight.profiles || !highlight.visibility) return null;
  const shared = highlight.visibility !== "private";

  async function change(visibility) {
    const previous = highlight;
    onChange?.({ ...highlight, visibility });
    try {
      const { data } = await axios.patch(`/api/highlights/${highlight.id}`, { highlight: { visibility } });
      onChange?.({ ...highlight, visibility: data.visibility, shared_at: data.shared_at });
      if (!shared) toast?.("Shared to your timeline");
      else if (visibility === "private") toast?.("Taken off your timeline");
    } catch {
      onChange?.(previous);
      toast?.("Couldn't change who sees it", { tone: "error" });
    }
  }

  if (iconOnly) {
    return (
      <VisibilityPicker value={highlight.visibility} options={shared ? HIGHLIGHT_VISIBILITY : TIMELINE_AUDIENCES} onChange={change} align="right" up={up}
        title={shared ? "On your timeline" : "Share to timeline"} className={`wb-btn wb-btn--icon ${shared ? "wb-hl-shared" : ""}`}>
        <Send size={15} aria-label={shared ? "On your timeline" : "Share to timeline"} />
      </VisibilityPicker>
    );
  }
  if (shared) {
    return <VisibilityPicker value={highlight.visibility} options={HIGHLIGHT_VISIBILITY} onChange={change} align="right" up={up} title="Who sees this on your timeline" />;
  }
  return (
    <VisibilityPicker value="private" options={TIMELINE_AUDIENCES} onChange={change} align="right" up={up} title="Share to your timeline" className="wb-btn">
      <Send size={15} aria-hidden="true" /> Share to timeline
    </VisibilityPicker>
  );
}
