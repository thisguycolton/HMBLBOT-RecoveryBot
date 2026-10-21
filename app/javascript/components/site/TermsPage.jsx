import React, { useEffect } from "react";
import { ScrollText } from "lucide-react";

// The terms of use (/terms, TermsController). Written in plain language to match the privacy
// policy (/privacy); when a rule here changes, change UPDATED too.
const UPDATED = "October 22, 2026";

const SECTIONS = [
  ["short-version", "The short version"],
  ["who-we-are", "Who we are"],
  ["not-advice", "Not medical or professional advice"],
  ["accounts", "Your account"],
  ["anonymity", "Respecting anonymity"],
  ["acceptable-use", "Using the site well"],
  ["your-content", "What you post"],
  ["groups", "Groups and their records"],
  ["premium", "Premium groups and contributions"],
  ["court", "Court attendance verifications"],
  ["readings", "Readings and copyright"],
  ["no-warranty", "No guarantees"],
  ["liability", "Limits on our liability"],
  ["ending", "Ending your use"],
  ["changes", "Changes and contact"],
];

function H2({ id, children }) {
  return <h2 id={id} className="scroll-mt-24">{children}</h2>;
}

export default function TermsPage() {
  // The page draws after load, so a link to a section (/terms#court) scrolls once it's there
  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);

  const contact = <a href="/contact">the Contact page</a>;
  const privacy = <a href="/privacy">privacy policy</a>;

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-14 !font-sans [&_*]:!font-sans">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 space-y-1 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">On this page</p>
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-2 py-1 !text-slate-600 !no-underline hover:bg-white hover:!text-slate-900 dark:!text-neutral-400 dark:hover:bg-neutral-900 dark:hover:!text-white">{label}</a>
            ))}
          </nav>
        </aside>

        <article className="prose prose-slate max-w-none [&_p]:!text-left [&_li]:!text-left dark:prose-invert prose-headings:font-semibold prose-a:text-accent prose-h2:mt-10 prose-h2:text-xl">
          <div className="not-prose mb-8 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/30 dark:text-white">
              <ScrollText className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <div>
              <h1 className="!m-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Terms of use</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Last updated {UPDATED}</p>
            </div>
          </div>

          <p className="lead">
            These terms are the rules for using RecoveryBot. By creating an account or using the site, you agree to them and to
            our {privacy}. We've kept them short and plain; if something isn't clear, ask us through {contact}.
          </p>

          <H2 id="short-version">The short version</H2>
          <ul>
            <li>RecoveryBot is free to use, run by HMBLBOT, and isn't part of Alcoholics Anonymous. Groups can pay for premium tools.</li>
            <li>It's a set of tools, not medical, legal or professional advice, and not a crisis service.</li>
            <li>Protect other people's anonymity. Don't share what members post or say outside the place it was shared.</li>
            <li>Be kind, don't spam, don't break the site, and don't post anything you don't have the right to post.</li>
            <li>What you write stays yours. You let us store and show it so the site can work.</li>
            <li>We do our best, but the site comes as it is, and things can go wrong.</li>
          </ul>

          <H2 id="who-we-are">Who we are</H2>
          <p>
            RecoveryBot is a set of tools, free to use, for people in recovery and the groups they belong to, run by HMBLBOT
            (“we” and “us” on this page). It isn't part of, or endorsed by, Alcoholics Anonymous World Services, Inc., the
            General Service Office, or any AA intergroup. Group pages on RecoveryBot are kept by the groups themselves and don't
            speak for AA as a whole.
          </p>

          <H2 id="not-advice">Not medical or professional advice</H2>
          <p>
            Nothing on RecoveryBot is medical, psychological, legal or other professional advice, and using it doesn't replace a
            doctor, counselor, sponsor or your program. Members' posts are their own experience, not guidance from us.
          </p>
          <p>
            <strong>RecoveryBot is not watched around the clock and can't help in an emergency.</strong> If you're in danger or
            thinking about harming yourself, call your local emergency number. In the United States you can call or text 988 to
            reach the Suicide and Crisis Lifeline, or call the SAMHSA National Helpline at 1-800-662-4357, free and confidential, any time.
          </p>

          <H2 id="accounts">Your account</H2>
          <ul>
            <li>You need to be at least 13 to use RecoveryBot. The site is meant for adults.</li>
            <li>One account per person. Use an email address you can reach; we confirm it before you can sign in.</li>
            <li>You don't have to use your real name, but don't pretend to be someone else.</li>
            <li>Keep your password to yourself. You're responsible for what's done with your account; tell us through {contact} if you think someone else got in.</li>
          </ul>

          <H2 id="anonymity">Respecting anonymity</H2>
          <p>
            Anonymity is what makes many of the people here feel safe. When you use RecoveryBot you agree that:
          </p>
          <ul>
            <li>You won't share, screenshot or repost anything other members shared with a group, their followers or members only, outside the place it was shared.</li>
            <li>You won't reveal that someone is in recovery, or who they are, without their permission.</li>
            <li>When you keep group records, you'll follow your group's anonymity practices: first names only, and nothing said in a meeting that wasn't meant to leave the room.</li>
          </ul>

          <H2 id="acceptable-use">Using the site well</H2>
          <p>Please don't use RecoveryBot to:</p>
          <ul>
            <li>harass, threaten, shame or bully anyone, or post hateful content;</li>
            <li>post anything illegal, sexual, or that encourages self-harm or drinking and drug use;</li>
            <li>sell things, advertise, recruit, or send spam;</li>
            <li>collect information about other members, or copy the site with bots or scrapers;</li>
            <li>get around sign-in, permissions or our bot checks, or try to break, overload or probe the site;</li>
            <li>upload viruses or anything else meant to cause harm.</li>
          </ul>
          <p>
            If you see something that breaks these rules, tell the group's admins or report it through {contact}. We may remove
            content or suspend accounts that break them.
          </p>

          <H2 id="your-content">What you post</H2>
          <p>
            Notes, highlights, pictures, documents and anything else you post stay yours. To run the site we need your permission
            to store them, copy them (for example into backups), and show them to the people you chose to share them with. You
            give us that permission, without charge, for as long as they're on RecoveryBot; it ends when you delete them or your
            account, apart from what the {privacy} says stays (such as group records you helped write).
          </p>
          <p>
            Only post things you have the right to post. Don't upload other people's photos, private messages or copyrighted work
            without permission.
          </p>

          <H2 id="groups">Groups and their records</H2>
          <p>
            Group admins decide who joins their group, what its pages show, and who can keep its records. Minutes, decisions,
            schedules and treasurer reports belong to the group, so they stay with the group if a member leaves. We aren't
            responsible for how a group runs itself, but we may step in if a group's pages break these terms.
          </p>
          <p>
            Treasurer reports and other records are kept for the group's convenience. They aren't official financial or legal
            records, so keep your own copies of anything you need.
          </p>

          <H2 id="premium">Premium groups and contributions</H2>
          <ul>
            <li>
              A group can pay for premium tools (business meetings, decisions, documents, elected officials, treasury, the Hosting
              Command Center and online contributions), billed yearly through Stripe. A group admin pays, and can cancel any time in
              Manage billing; premium then lasts to the end of the year paid for. We don't refund part of a year unless the law requires it.
            </li>
            <li>
              If a renewal fails, premium keeps working for 30 days. After that the group keeps everything it wrote, readable as before,
              but can't add to or change its premium records until it renews. We never delete a group's records for not paying.
            </li>
            <li>
              Online 7th Tradition contributions go into the group's own Stripe account, under Stripe's terms. The group is the one
              taking them: it's responsible for its account, refunds and any taxes. RecoveryBot takes no cut, never holds the money,
              and keeps only totals, not who gave.
            </li>
          </ul>

          <H2 id="court">Court attendance verifications</H2>
          <p>
            When a group signs an attendance verification, RecoveryBot records what that group confirmed and emails a copy. We
            don't check attendance ourselves, and we can't promise that a court, probation officer or anyone else will accept it.
            Groups must only sign for meetings a person actually attended; signing a false verification may break the law and
            will get the account suspended.
          </p>

          <H2 id="readings">Readings and copyright</H2>
          <p>
            Some readings in the library come from recovery literature. If you own the rights to something on RecoveryBot and
            don't want it here, tell us through {contact} with what it is and where it appears, and we'll take it down while we
            look into it.
          </p>

          <H2 id="no-warranty">No guarantees</H2>
          <p>
            RecoveryBot is provided “as is”. We work to keep it running, accurate and safe, but we can't promise it will
            always be available, free of mistakes, or that nothing will ever be lost. Meeting times and places come from groups and
            public directories and can be out of date, so check with the meeting if it matters. Keep copies of anything important.
          </p>

          <H2 id="liability">Limits on our liability</H2>
          <p>
            As far as the law allows, HMBLBOT and the people who run RecoveryBot aren't liable for indirect or unexpected losses
            from using the site, for what other members or groups post or do, or for the site being unavailable. Our total
            liability for anything to do with it is limited to US$50, or what your group paid us in the last 12 months if that's more. Some places don't allow these limits, so
            they may not all apply to you.
          </p>

          <H2 id="ending">Ending your use</H2>
          <p>
            You can stop using RecoveryBot and delete your account at any time from <a href="/users/edit">your profile</a>. We may
            suspend or close an account that breaks these terms or puts other members at risk, and we'll tell you why when we can.
            We may also change or stop parts of the site; if we ever shut it down, we'll give notice so you can save your things.
          </p>

          <H2 id="changes">Changes and contact</H2>
          <p>
            If we change these terms, we'll update this page and the date at the top, and for big changes we'll put a notice on the
            site before they take effect. Using RecoveryBot after that means you accept the new terms. Questions go to {contact}.
          </p>
        </article>
      </div>
    </div>
  );
}
