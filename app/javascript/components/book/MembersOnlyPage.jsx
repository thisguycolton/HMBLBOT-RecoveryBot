import React from "react";
import { ArrowLeft, Lock, LogIn, Users } from "lucide-react";
import "../../styles/writebook.css";

// What someone sees in place of a members-only book they can't open (MembersOnly on the
// server): that it's for members of groups that read it, and how to get in. Sign in first;
// then join a group that has it in its approved literature (listed, when any do), or have
// your own group add it. Shown by the reader and the book's page in the library.
export default function MembersOnlyPage({ info, backHref = "/library", embedded = false }) {
  const groups = info?.groups || [];
  const title = info?.title || "This book";

  return (
    <div className={`wb wb-members-only ${embedded ? "wb-members-only--embedded" : ""}`}>
      <div className="wb-members-only__card">
        <span className="wb-members-only__icon"><Lock size={26} aria-hidden="true" /></span>
        <h1 className="wb-members-only__title">{title} is for members of groups that read it</h1>
        <p className="wb-members-only__lead">
          Some books in the library are only open to signed-in members of a group that has added
          the book to its approved literature.
        </p>

        <h2 className="wb-members-only__label">How to get access</h2>
        <ol className="wb-members-only__steps">
          {!info?.signed_in && (
            <li>
              <strong>Sign in.</strong> If you're already in a group that reads it, that's all you need.
              <div className="wb-members-only__actions">
                <a className="wb-btn wb-btn--reversed" href="/users/sign_in"><LogIn size={16} aria-hidden="true" /> Sign in</a>
                <a className="wb-btn" href="/users/sign_up">Create an account</a>
              </div>
            </li>
          )}
          <li>
            <strong>Join a group that reads it.</strong>{" "}
            {groups.length > 0 ? "These groups have it in their approved literature:" : "No group has added it to its literature yet."}
            {groups.length > 0 && (
              <ul className="wb-members-only__groups">
                {groups.map((g) => (
                  <li key={g.slug}>
                    <a href={g.url}><Users size={15} aria-hidden="true" /> {g.title}</a>
                  </li>
                ))}
                {info.more_groups && <li className="wb-members-only__more">and more</li>}
              </ul>
            )}
          </li>
          <li>
            <strong>Or add it to your group.</strong> If your group reads it, a group admin can add it
            under the group's Settings, in Approved literature. Everyone in the group can open it then.
            <div className="wb-members-only__actions">
              <a className="wb-btn" href="/groups">Your groups</a>
            </div>
          </li>
        </ol>

        <a className="wb-members-only__back" href={backHref}><ArrowLeft size={16} aria-hidden="true" /> Back to the library</a>
      </div>
    </div>
  );
}
