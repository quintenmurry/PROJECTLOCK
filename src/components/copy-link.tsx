"use client";
import { useState } from "react";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link"
        className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-700" />
      <button type="button" className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
        onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
