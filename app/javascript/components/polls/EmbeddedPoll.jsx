import React, { useState } from "react";
import { Copy, ExternalLink, QrCode as QrIcon, Vote } from "lucide-react";
import { QrCode, QrDialog } from "../ui/QrCode";
import { showToast } from "../../lib/toast";
import PollCard from "./PollCard";
import usePoll from "./usePoll";
import { shortUrl } from "./lib";

const smallButton =
  "inline-flex items-center gap-1 rounded-lg !bg-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:!bg-neutral-100 hover:text-slate-800 dark:text-neutral-400 dark:hover:!bg-neutral-800 dark:hover:text-white";

// A poll inside something else (a reading, a motion), voting and live results in place.
// `screen`: shared on screen from HostDeck, so the QR code and short link show big beside it
// for people to scan off Zoom. `footer(poll)` adds the host page's own buttons.
export default function EmbeddedPoll({ token, screen = false, footer }) {
  const { poll, setPoll, error } = usePoll(token);
  const [qr, setQr] = useState(false);

  if (error && !poll) return null;
  if (!poll) return <div className="h-40 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-800" aria-label="Loading poll" />;

  const url = shortUrl(poll);
  const bare = url.replace(/^https?:\/\//, "");
  const copy = () => navigator.clipboard?.writeText(url).then(() => showToast("Link copied.", { tone: "success" }));

  return (
    <section className="not-prose rounded-3xl border border-neutral-200 bg-white p-4 font-sans text-slate-900 shadow-panel dark:border-neutral-700 dark:bg-neutral-900 dark:text-white sm:p-5 [&_*]:!font-sans">
      <div className={screen ? "grid items-start gap-6 md:grid-cols-[1fr_auto]" : ""}>
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Vote className="size-4" /></span>
            <h3 className="min-w-0 flex-1 !text-lg font-semibold leading-snug">{poll.question}</h3>
          </div>
          {/* On a shared screen everyone in the meeting sees it, so names stay off */}
          <PollCard poll={screen ? { ...poll, options: poll.options.map((o) => ({ ...o, voters: null })) } : poll} onChange={setPoll} />
          {!screen && (
            <div className="flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
              <a href={poll.short_path} className={smallButton}><ExternalLink className="size-3.5" /> {bare}</a>
              <button type="button" className={smallButton} onClick={copy}><Copy className="size-3.5" /> Copy link</button>
              <button type="button" className={smallButton} onClick={() => setQr(true)}><QrIcon className="size-3.5" /> QR code</button>
              {footer && <div className="ml-auto flex flex-wrap gap-1">{footer(poll)}</div>}
            </div>
          )}
        </div>
        {screen && (
          <div className="text-center">
            <QrCode url={url} size={220} className="mx-auto" />
            <p className="mt-2 font-mono text-lg font-semibold">{bare}</p>
            <p className="text-sm text-slate-500 dark:text-neutral-400">Scan or type it to vote</p>
          </div>
        )}
      </div>
      {qr && <QrDialog url={url} title={poll.question} text={bare} onClose={() => setQr(false)} />}
    </section>
  );
}
