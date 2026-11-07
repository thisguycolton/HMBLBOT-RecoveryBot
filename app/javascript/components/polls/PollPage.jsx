import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Lock, LockOpen, Pencil, QrCode as QrIcon, Trash2, Vote } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { QrDialog } from "../ui/QrCode";
import Skeleton from "../ui/Skeleton";
import { showToast } from "../../lib/toast";
import PollCard from "./PollCard";
import usePoll from "./usePoll";
import { api, buttonClass, shortUrl } from "./lib";

export function Message({ title, text }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow-panel dark:bg-neutral-900">
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">{text}</p>
    </div>
  );
}

// A poll's own page, at its short link (/p/:token) and /polls/:token
export default function PollPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { poll, setPoll, error } = usePoll(token);
  const [qr, setQr] = useState(false);

  if (error && !poll) return <Message title="Couldn't open this poll" text={error} />;
  if (!poll) return <Skeleton variant="page" />;

  const url = shortUrl(poll);
  const manage = async (path, method, message) => {
    try {
      setPoll(await api(`/${token}${path}`, { method }));
      if (message) showToast(message, { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${poll.question}” and all its votes? This can't be undone.`)) return;
    try {
      await api(`/${token}`, { method: "DELETE" });
      showToast("Poll deleted.", { tone: "success" });
      navigate("/polls");
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };
  const removeBallot = (voter) => {
    if (window.confirm(`Remove ${voter.name}'s vote?`)) manage(`/ballots/${voter.id}`, "DELETE", "Vote removed.");
  };
  const copy = () => navigator.clipboard?.writeText(url).then(() => showToast("Link copied.", { tone: "success" }));

  const subtitle = [poll.group?.name, poll.subject && `${poll.subject.type === "Motion" ? "Motion" : "Reading"}: ${poll.subject.title}`].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-2xl space-y-4 !font-sans [&_*]:!font-sans">
      <Shell>
        <ShellBand icon={Vote} title={poll.question} subtitle={subtitle || "Poll"} />
        <ShellPanel position="middle" className="p-4">
          <PollCard poll={poll} onChange={setPoll} onRemoveBallot={poll.can_manage ? removeBallot : null} />
        </ShellPanel>
        <ShellPanel position="bottom" className="flex flex-wrap items-center gap-2 p-3">
          <span className="mr-auto hidden min-w-0 truncate px-1 font-mono text-sm sm:block text-slate-600 dark:text-neutral-300">{url.replace(/^https?:\/\//, "")}</span>
          <button type="button" className={buttonClass} onClick={copy}><Copy className="size-4" /> Copy link</button>
          <button type="button" className={buttonClass} onClick={() => setQr(true)}><QrIcon className="size-4" /> QR code</button>
        </ShellPanel>
      </Shell>

      {poll.can_manage && (
        <div className="flex flex-wrap gap-2">
          <Link to={`/polls/${token}/edit`} className={buttonClass}><Pencil className="size-4" /> Edit</Link>
          {poll.closed ? (
            <button type="button" className={buttonClass} onClick={() => manage("/reopen", "POST", "Poll reopened.")}><LockOpen className="size-4" /> Reopen</button>
          ) : (
            <button type="button" className={buttonClass} onClick={() => manage("/close", "POST", "Poll closed.")}><Lock className="size-4" /> Close now</button>
          )}
          <button type="button" className={`${buttonClass} !text-red-600`} onClick={remove}><Trash2 className="size-4" /> Delete</button>
          <Link to="/polls" className="ml-auto self-center text-sm text-slate-500 hover:underline dark:text-neutral-400">All polls</Link>
        </div>
      )}

      {qr && <QrDialog url={url} title={poll.question} text={url.replace(/^https?:\/\//, "")} onClose={() => setQr(false)} />}
    </div>
  );
}
