import React, { useEffect, useState } from "react";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// The ALTCHA box dressed like the form's own fields (its CSS variables reach inside the widget)
const ALTCHA_LOOK = {
  "--altcha-max-width": "100%",
  "--altcha-border-radius": "0.75rem",
  "--altcha-border-color": "rgb(203 213 225 / 0.8)",
  "--altcha-color-base": "transparent",
  "--altcha-color-base-content": "currentColor",
  "--altcha-color-primary": "#0b6ede",
  "--altcha-checkbox-border-radius": "0.375rem",
};

// The form half of HumanCheck (app/services/human_check.rb) for a plain HTML form: a decoy field
// people never see, the signed time the form was drawn, and the "I'm not a robot" box: ALTCHA
// (a puzzle the browser solves, nothing leaves the site) or Cloudflare's widget when the site has
// Turnstile keys. `check` is HumanCheck.fields from the server.
export default function HumanCheckFields({ check }) {
  const siteKey = check?.turnstile_site_key;
  const altcha = check?.altcha;
  const [altchaReady, setAltchaReady] = useState(false);

  useEffect(() => {
    if (!siteKey || document.querySelector(`script[src="${TURNSTILE_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [siteKey]);

  // The widget is a web component; load it only on the forms that use it
  useEffect(() => {
    if (!altcha) return;
    import("altcha").then(() => setAltchaReady(true));
  }, [altcha]);

  if (!check) return null;
  return (
    <>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={`hc-${check.decoy}`}>Leave this empty</label>
        <input id={`hc-${check.decoy}`} type="text" name={check.decoy} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <input type="hidden" name={check.stamp_field} value={check.stamp} />
      {siteKey && <div className="cf-turnstile" data-sitekey={siteKey} />}
      {altcha && (
        <div className="human-check min-h-[66px]" style={ALTCHA_LOOK}>
          {altchaReady && (
            <altcha-widget
              challenge={JSON.stringify(altcha)}
              name="altcha"
              auto="onfocus"
              type="checkbox"
              configuration={JSON.stringify({ hideFooter: true, hideLogo: true, humanInteractionSignature: false })}
            />
          )}
        </div>
      )}
    </>
  );
}
