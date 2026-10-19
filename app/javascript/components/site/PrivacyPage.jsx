import React, { useEffect } from "react";
import { ShieldCheck } from "lucide-react";

// The privacy policy (/privacy, PrivacyController). Keep it true to the code: when a feature
// starts collecting something new, or a cookie or outside service is added, change this page
// (and UPDATED) in the same change.
const UPDATED = "October 19, 2026";

const SECTIONS = [
  ["short-version", "The short version"],
  ["anonymity", "Anonymity"],
  ["what-we-collect", "What we collect"],
  ["who-sees-what", "Who sees what"],
  ["cookies", "Cookies and browser storage"],
  ["outside-services", "Outside services"],
  ["email", "Email"],
  ["what-we-dont-do", "What we don't do"],
  ["deleting", "Keeping and deleting"],
  ["your-choices", "Your choices"],
  ["children", "Children"],
  ["changes", "Changes and contact"],
];

const COOKIES = [
  ["_acid_test_session", "Keeps you signed in while you use the site and protects forms from being sent by other sites.", "Until you close the browser"],
  ["remember_user_token", "Keeps you signed in between visits, only if you tick “Remember me”.", "2 weeks, or until you sign out"],
  ["group_ask, group_invite", "Remembers the group you asked to join or were invited to while you sign in or sign up. Removed once used.", "30 days"],
  ["event_rsvp_…", "Lets you change your RSVP to an event if you answered without an account.", "Until you clear it"],
  ["hb_voter", "Lets you change your answers to a schedule poll if you voted without an account.", "Until you clear it"],
];

const STORAGE = [
  ["theme", "Light, dark or system appearance"],
  ["findMeeting.view", "List or map view in Find a meeting"],
  ["doc-paper", "Page color in the document editor"],
  ["questScreenName, questChime", "Your screen name and sound setting in The Acid Quest"],
];

function H2({ id, children }) {
  return <h2 id={id} className="scroll-mt-24">{children}</h2>;
}

function Table({ head, rows }) {
  return (
    <div className="not-prose my-4 overflow-x-auto rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) => (
            <tr key={row[0]} className="align-top">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? "whitespace-nowrap font-mono text-xs text-slate-800 dark:text-neutral-200" : "text-slate-600 dark:text-neutral-300"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage({ turnstile = false }) {
  // The page draws after load, so a link to a section (/privacy#deleting) scrolls once it's there
  useEffect(() => {
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);

  const contact = <a href="/contact">the Contact page</a>;

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
              <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <div>
              <h1 className="!m-0 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Privacy policy</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Last updated {UPDATED}</p>
            </div>
          </div>

          <p className="lead">
            RecoveryBot is a free set of tools for people in recovery and the groups they belong to, run by HMBLBOT. People in
            Alcoholics Anonymous and other twelve-step programs value their anonymity, so we try to collect as little as we can,
            show it to as few people as we can, and tell you plainly what happens to it.
          </p>
          <p>
            RecoveryBot isn't part of, or endorsed by, Alcoholics Anonymous World Services, Inc. or any AA intergroup.
          </p>

          <H2 id="short-version">The short version</H2>
          <ul>
            <li>You can use the Topicificator, the readings and Find a meeting without an account. We don't need your real name.</li>
            <li>Profiles, notes, highlights and member lists are only ever shown to signed-in members, never to the public web or search engines.</li>
            <li>We don't sell or rent anything about you, show ads, or use advertising trackers.</li>
            <li>We don't use cookies to track you. The few cookies we set keep you signed in and make forms work, so there's no cookie banner.</li>
            <li>You can delete your account yourself from your profile page.</li>
          </ul>

          <H2 id="anonymity">Anonymity</H2>
          <p>
            Please sign up with a first name and last initial, or any name your group knows you by. Your email address is never shown
            to other members. If you add a sobriety date it stays hidden unless you switch on “Show my sobriety date”.
          </p>
          <p>
            Groups keep records here: minutes, decisions, service positions, host schedules and treasurer reports. Those records can
            name members, so we ask the people who keep them to follow their group's anonymity practices: first names only, and nothing
            said in a meeting that wasn't meant to leave the room.
          </p>

          <H2 id="what-we-collect">What we collect</H2>
          <h3>Things you give us</h3>
          <ul>
            <li><strong>Your account:</strong> name, email address and password. The password is stored only as a one-way hash; nobody can read it. We email you a link to confirm the address before you can sign in.</li>
            <li><strong>Your profile:</strong> username, picture, a short bio, an optional sobriety date, and how you lay out your profile page.</li>
            <li><strong>Notes and highlights:</strong> passages you highlight in the library, notes you write on them, and notes on your timeline (with up to six pictures). Each one has its own visibility (see below).</li>
            <li><strong>Follows:</strong> who you follow and who follows you.</li>
            <li><strong>Groups:</strong> the groups you join or ask to join, your role (member, admin, record keeper, host scheduler, treasurer), and the meetings you host or cover.</li>
            <li><strong>Group records:</strong> documents, decisions, business meeting agendas and minutes, elected officials, host schedules and treasurer reports that members write for their group.</li>
            <li><strong>Events:</strong> events you create, and RSVPs. If you RSVP without an account we ask for a name and email address so we can send you the event's updates.</li>
            <li><strong>Schedule polls:</strong> your answers, and a name if you vote without an account. To stop the same person voting twice without an account, we keep a scrambled (hashed) form of your IP address with the vote, not the address itself.</li>
            <li><strong>Court attendance verifications:</strong> when a group signs one, the name and email of the person who attended, the meeting, its date and topic, and who signed it. A copy is emailed to that person and to the group.</li>
            <li><strong>Readings and reports:</strong> readings you add to the shared archive, and any problems you report in the library's text.</li>
            <li><strong>The Acid Quest:</strong> a screen name and your progress in the game.</li>
            <li><strong>Messages to us:</strong> what you send through the Contact page (your name if you give one, your email and your message) is emailed to us and kept so the people who run the site can answer it. Ask us if you'd like it deleted afterwards.</li>
          </ul>
          <h3>Things we record when you visit</h3>
          <ul>
            <li>
              <strong>Visit statistics:</strong> which pages are viewed, the browser and device type, the site that linked you here, and a rough
              location (city, region and country) worked out from your IP address. We cut off the last part of every IP address before
              saving it, and we don't use a cookie to recognize you. If you're signed in, the visit is linked to your account so we can see
              when you were last active. Only site admins see these statistics, and only as totals.
            </li>
            <li><strong>Server logs and errors:</strong> our server keeps short technical logs (including IP addresses) to keep the site running. When something breaks, an error report goes to our own error tracker; it doesn't include your IP address.</li>
          </ul>
          <h3>Things that come from elsewhere</h3>
          <ul>
            <li>
              <strong>AA Intergroup meeting list:</strong> Find a meeting copies the public meeting directory published by the Online
              Intergroup of AA. It's information about meetings, not about you, and we don't send them anything.
            </li>
          </ul>

          <H2 id="who-sees-what">Who sees what</H2>
          <ul>
            <li><strong>The public web:</strong> the home page, the tools, Find a meeting, published events, and the parts of a group's home page that its admins choose to show visitors. Profiles are never public.</li>
            <li><strong>Signed-in members:</strong> profiles, and notes or highlights set to <em>Members</em>. Notes set to <em>Followers</em> are only seen by people who follow you; <em>Private</em> ones (the default) only by you. Highlights you share by link can be opened by anyone with that link.</li>
            <li><strong>Your groups:</strong> members of a group see its member list, its members-only pages and records, and notes you share to it. Record keepers and admins of the group see drafts and everything else the group keeps.</li>
            <li><strong>Site admins:</strong> the few people who run RecoveryBot can see what's stored, to fix problems and answer requests. We don't browse your things without a reason.</li>
          </ul>
          <p>Search engines can't reach anything behind sign-in and are asked to stay out of the library and readings. AI crawlers are turned away from the whole site.</p>

          <H2 id="cookies">Cookies and browser storage</H2>
          <p>
            Every cookie RecoveryBot sets is our own and is needed for something you asked to do. None are used for advertising or to
            follow you around the web, which is why we don't ask you to accept cookies.
          </p>
          <Table head={["Cookie", "What it's for", "How long"]} rows={COOKIES} />
          <p>We also save a few settings in your browser's local storage. They never leave your device.</p>
          <Table head={["Setting", "What it's for"]} rows={STORAGE} />

          <H2 id="outside-services">Outside services</H2>
          <p>These services handle some data for us, only to do the job listed:</p>
          <ul>
            <li><strong>Hosting:</strong> the site and its database run on a server we rent, managed with CapRover.</li>
            <li><strong>Amazon Web Services (S3):</strong> stores uploaded files such as profile pictures, note pictures and group documents, in the United States.</li>
            <li><strong>Apple iCloud Mail:</strong> sends the site's emails.</li>
            <li><strong>ipinfo.io:</strong> looks up the shortened IP address of a visit to get the rough location for visit statistics.</li>
            {turnstile && <li><strong>Cloudflare Turnstile:</strong> checks that the sign-up and contact forms are filled in by a person. Cloudflare sees your IP address and browser details when the check runs.</li>}
            <li>
              <strong>Fonts and page code:</strong> some pages load fonts from Google Fonts and code from public content networks
              (jsDelivr, unpkg, cdnjs and Google's hosted libraries). Your browser asks those servers for the files, so they see your IP
              address, as with any website you visit.
            </li>
            <li><strong>Buy Me a Coffee:</strong> older pages show a donate button loaded from Buy Me a Coffee. If you donate, that happens on their site under their privacy policy.</li>
            <li><strong>AI storyteller:</strong> The Acid Quest can ask an AI service (Google Gemini or OpenRouter) to write story text. It sends only game facts and topic titles, never anything about you.</li>
          </ul>
          <p>Links to other sites, such as Zoom meetings or our Discord, follow those sites' own policies once you leave RecoveryBot.</p>

          <H2 id="email">Email</H2>
          <p>
            We email you only when you need it or asked for it: a link to confirm your email address, a password reset, when someone adds
            you to a schedule poll, when an event you RSVP'd to posts an update (each has a link to stop them), and a copy of a court
            attendance verification made for you. Group news, like a scheduled business meeting or a host assignment, shows up in
            the notification bell on the site instead. We don't send newsletters or marketing.
          </p>

          <H2 id="what-we-dont-do">What we don't do</H2>
          <ul>
            <li>Sell, rent or trade information about you.</li>
            <li>Show ads, or use advertising or social media tracking pixels.</li>
            <li>Let anyone use your notes, highlights or group records to train AI models.</li>
            <li>Share anything with your court, employer or anyone else unless you or your group asks us to, or the law makes us.</li>
          </ul>

          <H2 id="deleting">Keeping and deleting</H2>
          <p>
            We keep your account until you delete it. To delete it, open <a href="/users/edit">your profile</a>, scroll to
            <em> Delete account</em>, and enter your password. That deletes, right away:
          </p>
          <ul>
            <li>your account, profile, picture and settings;</li>
            <li>your highlights, notes, timeline notes and their pictures;</li>
            <li>your follows, notifications, RSVPs, group memberships and schedule polls you made.</li>
          </ul>
          <p>
            Some things belong to a group or to everyone, so they stay without your account attached: group documents and minutes you
            edited, decisions you recorded, events and schedule poll answers. Your name stays where it was typed into a record (for
            example in minutes, or as the host of a meeting). Ask the group's record keepers, or us, if you'd like it taken out. If you've
            added readings to the shared archive, get in touch and we'll delete your account and sort out the readings with you.
          </p>
          <p>
            Visit statistics stay as anonymous totals once the account is gone. Copies in backups and server logs disappear as those
            are replaced. Court verification records are kept so the group can confirm attendance later; ask us if you need one removed.
          </p>

          <H2 id="your-choices">Your choices</H2>
          <ul>
            <li>Change your name, picture, bio, sobriety date and email from <a href="/users/edit">your profile</a>.</li>
            <li>Choose who sees each note and highlight, and set the default for new ones in your settings.</li>
            <li>Leave a group at any time from the group's page.</li>
            <li>Ask us, through {contact}, for a copy of what we have about you, to correct it, or to delete something. We'll answer whatever country you live in.</li>
          </ul>

          <H2 id="children">Children</H2>
          <p>RecoveryBot is meant for adults. Please don't sign up if you're under 13. If we learn that a child under 13 has an account, we'll delete it.</p>

          <H2 id="changes">Changes and contact</H2>
          <p>
            If we change what we collect or who sees it, we'll update this page and the date at the top, and for big changes we'll put a
            notice on the site. Questions or requests go to {contact}.
          </p>
        </article>
      </div>
    </div>
  );
}
