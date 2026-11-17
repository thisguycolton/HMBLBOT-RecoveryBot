// The offices the setup guide offers. Each fills a new office (ServicePosition) and says what
// holding it lets someone do on the site (`grants`, OfficeRoles::ROLES). Group admins can do
// everything already, so an office matters for the people who aren't admins.
// When Manage > Offices gets its own pre-made offices (ServiceView's PRESETS), this list should
// come from there so the two stay the same.
export const OFFICE_PRESETS = [
  {
    key: "chair",
    title: "Chair",
    hint: "Runs the business meeting.",
    description: "Opens and runs the group's business meetings and keeps them to the agenda.",
    term_months: 6, sobriety_months: 6, grants: "",
  },
  {
    key: "secretary",
    title: "Secretary",
    hint: "Keeps the agenda, minutes and the group's documents.",
    description: "Takes the minutes at business meetings, keeps the agenda and looks after the group's documents.",
    term_months: 6, sobriety_months: 6, grants: "can_keep_records", on_agenda: true, agenda_lines: "Last month's minutes: {name}",
  },
  {
    key: "treasurer",
    title: "Treasurer",
    hint: "Keeps the money and posts a report each month.",
    description: "Collects the Seventh Tradition, keeps the prudent reserve and gives a report each month.",
    term_months: 12, sobriety_months: 12, grants: "can_keep_treasury", on_agenda: true, agenda_lines: "Treasurer's report: {name}",
  },
  {
    key: "host_coordinator",
    title: "Host Coordinator",
    hint: "Fills the host schedule and finds subs.",
    description: "Keeps every meeting covered: fills the host and co-host places and finds a sub when someone can't make it.",
    term_months: 6, sobriety_months: 3, grants: "can_schedule_hosts", on_agenda: true, agenda_lines: "Host schedule: {name}",
  },
  {
    key: "gsr",
    title: "GSR",
    hint: "Carries the group's voice to the district.",
    description: "General Service Representative: goes to district meetings and reports back to the group.",
    term_months: 24, sobriety_months: 12, grants: "", on_agenda: true, agenda_lines: "GSR report: {name}",
  },
];

// What an office's role lets its holder do, in plain words (OfficeRoles::ROLES[:covers])
export const GRANT_LABELS = {
  can_keep_records: { label: "Record keeper", can: "Edit the agenda, the minutes and the group's documents" },
  can_keep_treasury: { label: "Treasurer", can: "Write the treasurer's reports" },
  can_schedule_hosts: { label: "Host coordinator", can: "Edit the host schedule and who can host" },
};

export const grantSentence = (grants) => (grants && GRANT_LABELS[grants] ? GRANT_LABELS[grants].can : "No extra access on the site");
