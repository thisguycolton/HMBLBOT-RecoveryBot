import React from "react";
import { Plus } from "lucide-react";
import Avatar from "./Avatar";
import { Card, Tray, primaryButton } from "./ui";

// Readings members tagged to this group (published ones; drafts stay with their author)
export default function ReadingsTab({ group }) {
  return (
    <div className="space-y-4">
      {group.is_member && (
        <a href="/readings/new" className={primaryButton}><Plus className="h-4 w-4" /> New reading</a>
      )}
      <Tray label="Shared with the group">
        {group.readings.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
            No readings yet. When members write a reading for {group.title}, it shows up here.
          </Card>
        ) : (
          <div className="space-y-1.5">
            {group.readings.map((r) => (
              <a key={r.id} href={`/readings/${r.id}`} className="block">
                <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
                  <Avatar person={r.author} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{r.title || "Untitled reading"}</p>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {r.author?.name}
                      {r.meeting_date && ` · ${new Date(`${r.meeting_date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </Tray>
    </div>
  );
}
