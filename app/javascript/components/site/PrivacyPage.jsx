import React, { useEffect } from "react";
import { ShieldCheck } from "lucide-react";

// The privacy policy (/privacy, PrivacyController). Keep it true to the code: when a feature
// starts collecting something new, or a cookie or outside service is added, change this page
// (and UPDATED) in the same change.
const UPDATED = "October 30, 2026";

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
  ["hosting-text-size", "Script text size in HostDeck"],
  ["hosting-share-size", "Text size of a service reading opened to share on screen"],
  ["questScreenName, questChime", "Your screen name and sound setting in The Acid Quest"],
  ["installNudge.dismissed", "That you closed the “Add RecoveryBot to your home screen” card"],
  ["hb-day-count-seen", "The day your day count last popped up, so a milestone celebration shows once that day"],
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
            <li>Your 10th step inventories, gratitude lists and chips are only ever shown to you, unless you choose up to five favorite chips to show on your profile.</li>
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
          <p>
            A group's page, which anyone can see, lists its meetings with the name of who hosts and co-hosts the next one, as the group
            wrote it on its host schedule. Each group can turn that off in its settings.
          </p>

          <H2 id="what-we-collect">What we collect</H2>
          <h3>Things you give us</h3>
          <ul>
            <li><strong>Your account:</strong> name, email address and password. The password is stored only as a one-way hash; nobody can read it. We email you a link to confirm the address before you can sign in.</li>
            <li><strong>Your profile:</strong> username, picture, a short bio, an optional sobriety date, and how you lay out your profile page.</li>
            <li><strong>Notes and highlights:</strong> passages you highlight in the library, notes you write on them, and notes on your timeline (with up to six pictures). Each one has its own visibility (see below).</li>
            <li><strong>10th step inventories and gratitude lists:</strong> what you write in the 10th step (your yes or no to each question and your notes) and your gratitude lists, one of each a day, with the day they're for. Only you can read them on the site: not your groups, not the people you follow. No admin page shows them; the few people who run RecoveryBot could reach them in the database, like anything stored, but we don't look.</li>
            <li><strong>Chips:</strong> the chips you earn are worked out from your sobriety date, the inventories and gratitude lists you've written (how many, and how many days in a row), and the meetings you joined. To count a meeting, we note when you click a meeting's Join button in the half hour before it starts: the meeting and its start time, nothing about the call itself. We also keep which chip you put on top when two mark the same milestone, and the favorites you picked and whether they show on your profile (off unless you turn it on).</li>
            <li><strong>Chips a group gives:</strong> a group's hosts, host coordinators and admins can give someone a chip. We keep who gave it, from which group, to whom, the milestone, the date and any note. If it's sent to an email address with no account yet, we keep that address and email it one link to claim the chip; the chip is added to the account made with that address. When giving one, they can find people in the group by name or email (they see names, not addresses); someone outside the group is only found if they type that person's whole email address. The group's hosts and admins can see the chips the group has given and whether they've been claimed, and can take one back.</li>
            <li><strong>Follows:</strong> who you follow and who follows you.</li>
            <li><strong>Reminders:</strong> if you turn on the daily gratitude or 10th step reminder, we keep whether each is on, the time you picked, the day it last went out, and your time zone as your browser reports it (like “America/Phoenix”), so the reminder comes at your time. Turning a reminder off stops it.</li>
            <li><strong>Notifications on your devices:</strong> if you turn on notifications for a phone or computer, we keep the address your browser's push service gave it, the keys that encrypt what we send, and the browser and device type (like “Safari on iPhone”) so you can tell your devices apart. Turning them off, removing the device in your settings, or signing out on that device deletes it.</li>
            <li><strong>Reactions, comments and reposts:</strong> the Like, Love or Hugs you give a note or comment, comments you write on notes, and notes you repost to your timeline.</li>
            <li><strong>Notes on someone's page:</strong> a note you write on the profile of someone you follow (or who follows you) is kept like your other notes, and also says whose page it's on. They're told, and they can take it off their page.</li>
            <li><strong>Group chat:</strong> messages you post in your groups' chat channels, when you posted and changed them, and how far you've read in each channel (so we can show what's new). We also keep each channel's name, what it's for, who added it and who's in it.</li>
            <li><strong>@ mentions:</strong> when you @ mention someone, or a role like @hosts, in a chat message, note or comment, we keep who it meant and who we told, and send them a notification. People are only told about things they can already read.</li>
            <li><strong>Reports and blocks:</strong> if you report someone to the site admins, we keep your report, who it's about, and a copy of what they wrote, so it can still be read if they delete it. If a group's admins block someone, we keep who was blocked from which group, and by whom.</li>
            <li><strong>Link previews:</strong> when a note has a link, our server visits that page to read its title, description and picture, and keeps them (with a copy of the picture) with your note. The other site sees a visit from RecoveryBot, not from you or the people reading your note.</li>
            <li><strong>Groups:</strong> the groups you join or ask to join, your role (member, admin, record keeper, host scheduler, treasurer), and the meetings you host or cover. While you have a meeting's HostDeck open, the group's other hosts see that you're there and what you're on, and what you did in it (like copying a chat posting) is kept with that meeting's date.</li>
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
            <li>
              <strong>Bot check:</strong> the sign-up and contact forms have an “I'm not a robot” box.{" "}
              {turnstile
                ? "It's run by Cloudflare Turnstile (see Outside services)."
                : "Ticking it has your browser solve a small math puzzle we made, which takes a second or two. It runs on your device; nothing about you is sent anywhere, and we only check the answer."}
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
            <li><strong>Signed-in members:</strong> profiles, and notes or highlights set to <em>Members</em>. Notes set to <em>Followers</em> are only seen by people who follow you; <em>Private</em> ones (the default) only by you. Highlights are private until you share one to your timeline. Highlights you share by link can be opened by anyone with that link. Anyone who can see a note sees its comments, and who reacted to it and how. Only notes set to <em>Members</em> can be reposted, and when you narrow or delete one, its reposts go too.</li>
            <li><strong>Only you:</strong> your 10th step inventories, gratitude lists and chips (except the favorite chips you choose to show on your profile, which members who can see your profile see), and notes set to <em>Private</em>.</li>
            <li><strong>Your groups:</strong> members of a group see its member list, its members-only pages and records, and notes you share to it. Record keepers and admins of the group see drafts and everything else the group keeps.</li>
            <li><strong>Group chat:</strong> what you post in a channel is seen by the people in that channel: everyone in the group for most channels, or only the group's admins and the roles and people a channel is limited to. A group's admins can delete any message. Typing in a channel briefly shows "is typing" to the others there; that isn't stored.</li>
            <li><strong>Notes on someone's page:</strong> seen as you choose when you write it: just the two of you, their followers, or Members.</li>
            <li><strong>Site admins:</strong> reports about people, with the copy of what was reported.</li>
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
          <p>
            Your browser also keeps a small script from us, called a service worker, so it can show notifications while RecoveryBot is closed and
            open the right page when you tap one. It doesn't save pages or anything about what you do.
          </p>

          <H2 id="outside-services">Outside services</H2>
          <p>These services handle some data for us, only to do the job listed:</p>
          <ul>
            <li><strong>Hosting:</strong> the site and its database run on a server we rent, managed with CapRover.</li>
            <li><strong>Amazon Web Services (S3):</strong> stores uploaded files such as profile pictures, note pictures and group documents, in the United States.</li>
            <li><strong>Apple iCloud Mail:</strong> sends the site's emails.</li>
            <li>
              <strong>Browser push services:</strong> if you turn on notifications, each one goes through the push service of the company that
              makes your browser (Apple for Safari, iPhone and iPad; Google for Chrome and Android; Mozilla for Firefox; Microsoft for Edge on
              Windows). It's encrypted so only your device can read it: the service sees that RecoveryBot sent your device something and when, not what it says.
            </li>
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
            attendance verification made for you. If a group gives a chip to an email address that has no account, that address gets one email with a link to claim it. If you host or co-host and turn on reminders in your account settings, we also email you
            before each meeting you're on, unless you choose notifications only. Other group news, like a scheduled business meeting or a host assignment, shows up in
            the notification bell on the site instead, and on your phone or computer if you turned on notifications there. We don't send newsletters or marketing.
          </p>

          <H2 id="what-we-dont-do">What we don't do</H2>
          <ul>
            <li>Sell, rent or trade information about you.</li>
            <li>Show ads, or use advertising or social media tracking pixels.</li>
            <li>Let anyone use your notes, highlights, inventories, gratitude lists or group records to train AI models.</li>
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
            <li>your 10th step inventories, gratitude lists, chip choices, meetings you joined, and chips given to you;</li>
            <li>your follows, reactions, comments, reposts, notifications (and the devices you get them on), RSVPs, group memberships and schedule polls you made;</li>
            <li>your chat messages and where you'd read up to, notes others wrote on your page, and reports you made or that were made about you.</li>
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
            <li>Choose who sees each note and highlight, and set the default for new notes in your settings. Highlights stay private until you share one to your timeline.</li>
            <li>Turn notifications on or off for each device, or remove a device, under <em>Notifications on this device</em> in <a href="/users/edit#notifications">your settings</a>, or block them in your browser.</li>
            <li>Leave a group at any time from the group's page.</li>
            <li>Clear a day's 10th step or gratitude list by emptying it and saving.</li>
            <li>Ask us, through {contact}, for a copy of what we have about you, to correct it, or to delete something. We'll answer whatever country you live in.</li>
          </ul>

          <H2 id="children">Children</H2>
          <p>RecoveryBot is meant for adults. Please don't sign up if you're under 13. If we learn that a child under 13 has an account, we'll delete it.</p>

          <H2 id="changes">Changes and contact</H2>
          <p>
            If we change what we collect or who sees it, we'll update this page and the date at the top, and for big changes we'll put a
            notice on the site. The rules for using the site are in the <a href="/terms">terms of use</a>. Questions or requests go to {contact}.
          </p>
        </article>
      </div>
    </div>
  );
}
