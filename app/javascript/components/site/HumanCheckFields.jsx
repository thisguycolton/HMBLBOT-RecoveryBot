import React, { useEffect } from "react";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// The hidden half of HumanCheck (app/services/human_check.rb) for a plain HTML form: a decoy
// field people never see, the signed time the form was drawn, and Cloudflare's widget when
// the site has Turnstile keys. `check` is HumanCheck.fields from the server.
export default function HumanCheckFields({ check }) {
  const siteKey = check?.turnstile_site_key;

  useEffect(() => {
    if (!siteKey || document.querySelector(`script[src="${TURNSTILE_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [siteKey]);

  if (!check) return null;
  return (
    <>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={`hc-${check.decoy}`}>Leave this empty</label>
        <input id={`hc-${check.decoy}`} type="text" name={check.decoy} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <input type="hidden" name={check.stamp_field} value={check.stamp} />
      {siteKey && <div className="cf-turnstile" data-sitekey={siteKey} />}
    </>
  );
}
