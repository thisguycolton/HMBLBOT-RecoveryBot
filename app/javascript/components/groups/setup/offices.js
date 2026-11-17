import { PRESETS } from "../conscience/ServiceView";

// The offices the setup guide offers: the same pre-made offices as Manage > Offices (ServiceView's
// PRESETS), so the two stay the same. Each fills a new office (ServicePosition) and says what
// holding it lets someone do on the site (`grants`, OfficeRoles::ROLES). Group admins can do
// everything already, so an office matters for the people who aren't admins. A host coordinator
// office added here covers the whole group (or the time its title names); admins pick its time
// slots in Manage > Offices.
export const OFFICE_PRESETS = PRESETS.filter((p) => p.form.title).map(({ about, form: { host_meeting_ids, ...form } }) => ({ // eslint-disable-line no-unused-vars
  key: form.title.toLowerCase().replace(/\s+/g, "_"),
  hint: about,
  ...form,
}));

// What an office's role lets its holder do, in plain words (OfficeRoles::ROLES[:covers])
export const GRANT_LABELS = {
  can_keep_records: { label: "Record keeper", can: "Edit the agenda, the minutes and the group's documents" },
  can_keep_treasury: { label: "Treasurer", can: "Write the treasurer's reports" },
  can_schedule_hosts: { label: "Host coordinator", can: "Edit the host schedule and who can host" },
};

export const grantSentence = (grants) => (grants && GRANT_LABELS[grants] ? GRANT_LABELS[grants].can : "No extra access on the site");
