import React, { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, ExternalLink, Globe, Smartphone } from "lucide-react";
import { appInfo } from "../../lib/appInfo";
import { api } from "../groups/lib";
import Markdown from "../book/Markdown";
import { Card, ErrorNote, Pill, Tray, primaryButton } from "../groups/ui";
import Skeleton from "../ui/Skeleton";

const NAME = { ios: "iPhone", android: "Android" };
const STORE = { ios: "TestFlight", android: "Google Play" };
const LIST = "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_p]:my-2";

const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

// Account settings > App info: which version and build of the app this is, whether a newer
// build is out (with how to update in TestFlight or Google Play), and what's new in each build
// (AppRelease, /api/app_info). In a browser: the site is always current, and what's new in the apps.
export default function AppInfoSettings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([appInfo(), api("/app_info")])
      .then(([device, info]) => setData({ device, ...info }))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Skeleton variant="form" rows={3} />;

  const { device, releases, latest, update_steps: steps } = data;
  const inApp = device.platform === "ios" || device.platform === "android";

  return (
    <>
      <Tray label={inApp ? "This app" : "This device"}>
        <Card className="space-y-4 p-4">
          {inApp ? <ThisApp device={device} latest={latest[device.platform]} steps={steps[device.platform]} /> : (
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div className="text-sm text-slate-600 dark:text-neutral-400">
                <div className="font-semibold text-slate-900 dark:text-white">You're on the website</div>
                It's always the newest version, so there's nothing to update. The iPhone and Android apps load this same site,
                so most changes reach them right away too. Their own builds are below.
              </div>
            </div>
          )}
        </Card>
      </Tray>

      {(inApp ? [device.platform] : ["ios", "android"]).map((platform) => {
        const list = releases.filter((r) => r.platform === platform);
        if (!list.length) return null;
        return (
          <Tray key={platform} label={inApp ? "What's new" : `What's new in the ${NAME[platform]} app`}>
            <Card className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {list.map((r) => (
                <div key={r.build} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Build {r.build}</span>
                    <span className="text-xs text-slate-500 dark:text-neutral-400">
                      Version {r.version}{r.released_on && ` · ${day(r.released_on)}`}
                    </span>
                    {inApp && r.build === device.build && <Pill tone="accent">You have this</Pill>}
                  </div>
                  {r.notes && <div className={`mt-1 text-sm text-slate-600 dark:text-neutral-400 ${LIST}`}><Markdown source={r.notes} /></div>}
                </div>
              ))}
            </Card>
          </Tray>
        );
      })}
    </>
  );
}

function ThisApp({ device, latest, steps }) {
  const known = device.build > 0;
  const behind = latest && (!known || device.build < latest);
  return (
    <>
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="text-sm text-slate-600 dark:text-neutral-400">
          <div className="font-semibold text-slate-900 dark:text-white">RecoveryBot for {NAME[device.platform]}</div>
          {known ? <>Version {device.version} · Build {device.build}</> : "An early test build (from before builds had numbers here)"}
        </div>
      </div>
      {behind ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <CircleAlert className="h-4 w-4 shrink-0" /> Build {latest} is out in {STORE[device.platform]}
          </div>
          {steps && (
            <>
              <div className={`mt-1 ${LIST}`}><Markdown source={steps.body} /></div>
              <a href={steps.link_url} target="_blank" rel="noopener noreferrer" className={`${primaryButton} mt-2`}>
                <ExternalLink className="h-4 w-4" /> {steps.link_label}
              </a>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="h-4 w-4 shrink-0" /> You have the newest build.
        </div>
      )}
    </>
  );
}
