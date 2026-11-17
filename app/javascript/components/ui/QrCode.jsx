import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";

// A QR code for a link, drawn in the browser (nothing is sent anywhere to make it). Dark on
// white whatever the theme, so every phone camera reads it.
export function QrCode({ url, size = 240, className = "" }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } })
      .then((s) => live && setSvg(s)).catch(() => live && setSvg(""));
    return () => { live = false; };
  }, [url]);
  return (
    <div role="img" aria-label="QR code" className={`rounded-2xl bg-white p-3 ring-1 ring-neutral-200 [&_svg]:h-full [&_svg]:w-full ${className}`}
      style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// Full screen, big, for holding a phone up to someone after a meeting
export function QrDialog({ url, title, text, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[2700] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-neutral-900">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">{title}</p>
        <QrCode url={url} size={280} className="mx-auto" />
        {text && <p className="text-sm text-slate-600 dark:text-neutral-400">{text}</p>}
      </div>
    </div>
  );
}
