import React from "react";
import { UserX } from "lucide-react";

// How to delete a RecoveryBot account (/delete-account, DeleteAccountsController), for people
// who aren't signed in or don't have the app. Google Play asks for a page like this, reachable
// without the app. The details are in the privacy policy (/privacy#deleting); keep the two true
// to each other and to Api::ProfilesController#destroy.
export default function DeleteAccountPage({ signedIn = false }) {
  const contact = <a href="/contact">the Contact page</a>;
  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-14 !font-sans [&_*]:!font-sans">
      <div className="mx-auto max-w-3xl">
        <article className="prose prose-slate max-w-none [&_p]:!text-left [&_li]:!text-left dark:prose-invert prose-headings:font-semibold prose-a:text-accent dark:prose-a:text-accent-light prose-h2:mt-10 prose-h2:text-xl">
          <div className="not-prose mb-8 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/30 dark:text-white">
              <UserX className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <div>
              <h1 className="!m-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Deleting your RecoveryBot account</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">RecoveryBot, by HMBLBOT · on the website and in the iPhone and Android apps</p>
            </div>
          </div>

          <h2>Delete it yourself</h2>
          <ol>
            <li>Sign in, on the website or in the app.</li>
            <li>Open <a href="/users/edit">your profile</a> (in the app: Menu, then Account, then <em>Profile &amp; account</em>).</li>
            <li>Scroll to <em>Delete account</em>, tap <em>Delete account…</em>, and enter your password (or, if you sign in with Google or Apple, your email address).</li>
          </ol>
          <p>It's deleted right away, and it can't be undone. {signedIn && <a href="/users/edit">Go to your profile</a>}</p>

          <h2>Can't sign in?</h2>
          <p>
            Write to us through {contact} from the email address on the account, and say you'd like it deleted. We'll confirm it's
            yours and delete it within 30 days, usually much sooner.
          </p>

          <h2>What's deleted</h2>
          <p>
            Your account, profile, picture and settings; your highlights, notes, timeline notes, 10th step inventories, gratitude lists, step
            work, chips, follows, reactions, comments, chat messages, notifications and the devices you get them on, RSVPs and group
            memberships. If you signed in with Apple, we also tell Apple to disconnect RecoveryBot from your Apple ID.
          </p>

          <h2>What stays, and for how long</h2>
          <p>
            Some things belong to a group or to everyone, so they stay without your account attached: group documents and minutes you
            edited, decisions you recorded, events, polls you made and poll answers. Your name stays where it was typed into a group's
            record. Visit statistics stay only as anonymous totals. Copies in backups and server logs disappear as those are replaced.
            Court attendance verifications are kept so a group can confirm attendance later; ask us if you need one removed.
            All the details are in our <a href="/privacy#deleting">privacy policy</a>.
          </p>
        </article>
      </div>
    </div>
  );
}
