"use client";
import { useEffect, useState } from "react";

/**
 * Illustrative load record for the home page hero, from the carrier's side. The data is fictional.
 * Plays one short sequence on load: the driver delivers, the POD lands, the customer opens the link.
 */
const STEPS = [
  { label: "Dispatched", who: "Driver: M. Reyes · Truck 14", time: "Tue 5:40" },
  { label: "Picked up", who: "Long Beach, Pier T · gate receipt", time: "Tue 6:18" },
  { label: "Delivered", who: "Ontario, CA", time: "Tue 10:51" },
];

export function JobRecordPreview() {
  const [stage, setStage] = useState(0); // 0: in transit, 1: delivered + POD, 2: customer viewed
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStage(2); return; }
    const a = setTimeout(() => setStage(1), 1400);
    const b = setTimeout(() => setStage(2), 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  const done = stage === 0 ? 2 : 3;
  return (
    <figure aria-label="Example load record" className="w-full max-w-md rounded-xl bg-white text-slate-900 shadow-2xl shadow-brand-950/40 ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="font-mono text-[15px] font-medium tracking-tight">MSDU 482019-3</div>
          <div className="mt-0.5 text-sm text-slate-500">40&apos; high cube · Import · Load #2231</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-500 ${stage >= 1 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
          {stage >= 1 ? "Delivered" : "In transit"}
        </span>
      </div>
      <ol className="px-5 py-4">
        {STEPS.map((s, i) => {
          const complete = i < done;
          return (
            <li key={s.label} className="relative flex gap-3 pb-3 last:pb-0">
              {i < STEPS.length - 1 && <span aria-hidden className={`absolute left-[7px] top-4 h-full w-px ${i < done - 1 ? "bg-brand-500" : "bg-slate-200"}`} />}
              <span aria-hidden className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 transition-colors duration-500 ${complete ? "border-brand-500 bg-brand-500" : "border-slate-300 bg-white"}`} />
              <div className="flex min-w-0 flex-1 justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className={complete ? "font-medium" : "text-slate-400"}>{s.label}</div>
                  <div className="truncate text-xs text-slate-500">{complete ? s.who : "Waiting"}</div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-slate-500">{complete ? s.time : ""}</div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-3 text-xs">
        <Doc ok label="Delivery order" />
        <Doc ok label="Gate receipt" />
        <Doc ok={stage >= 1} label={stage >= 1 ? "Signed POD" : "POD missing"} />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs">
        <span className="text-slate-600">Shared with Harborline Forwarding</span>
        <span className={`font-medium transition-colors duration-500 ${stage === 2 ? "text-brand-700" : "text-slate-400"}`}>
          {stage === 2 ? "POD downloaded just now" : "Link sent"}
        </span>
      </div>
    </figure>
  );
}

function Doc({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors duration-500 ${ok ? "bg-slate-100 text-slate-700" : "bg-signal-50 text-signal-700 ring-1 ring-inset ring-signal-400/60"}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {ok ? <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M6 2.5v4M6 8.8v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
      {label}
    </span>
  );
}
