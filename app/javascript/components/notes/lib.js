// Notes on people's timelines (Api::TimelineNotesController) and who sees them and
// highlights on a profile (Visibility on the server).
import { Globe, Lock, Users } from "lucide-react";
import { api } from "../groups/lib";

export const VISIBILITY = [
  { value: "private", label: "Only me", note: "Nobody else sees it on your profile", icon: Lock },
  { value: "followers", label: "Followers", note: "People who follow you", icon: Users },
  { value: "public", label: "Members", note: "Everyone signed in to RecoveryBot", icon: Globe },
];
export const visibilityOf = (value) => VISIBILITY.find((v) => v.value === value) || VISIBILITY[0];

// A note written on someone else's page: who sees it there, as if it were theirs
export const profileVisibility = (name) => [
  { value: "private", label: "Just you two", note: `Only you and ${name} see it`, icon: Lock },
  { value: "followers", label: "Their followers", note: `People who follow ${name}`, icon: Users },
  { value: "public", label: "Members", note: "Everyone signed in to RecoveryBot", icon: Globe },
];

// Highlights stay with their reader until they share one to their timeline (Share to
// timeline); then it's Followers or Members, and "private" takes it back off.
export const TIMELINE_AUDIENCES = VISIBILITY.filter((v) => v.value !== "private");
export const HIGHLIGHT_VISIBILITY = [
  ...TIMELINE_AUDIENCES,
  { value: "private", label: "Take off my timeline", note: "Only you see it again", icon: Lock },
];

// Saves a note, as multipart when pictures come along. fields: body, visibility,
// group_slugs, images (Files), remove_image_ids
export function saveNote(id, fields) {
  const path = id ? `/timeline_notes/${id}` : "/timeline_notes";
  const method = id ? "PATCH" : "POST";
  if (!fields.images?.length) {
    const { images, ...rest } = fields;
    return api(path, { method, body: { note: rest } });
  }
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) form.append(`note[${key}][]`, "");
      value.forEach((v) => form.append(`note[${key}][]`, v));
    } else if (value != null) {
      form.append(`note[${key}]`, value);
    }
  });
  return api(path, { method, form });
}
