"use client";
import { useRef } from "react";
import { switchCompany } from "@/app/(workspace)/actions";
import type { MyCompany } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";

export function CompanySwitcher({ companies, activeId }: { companies: MyCompany[]; activeId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const usable = companies.filter((c) => c.company_status === "active" && c.membership_status === "active");
  const active = usable.find((c) => c.company_id === activeId);
  if (usable.length <= 1) {
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{active?.name}</div>
        <div className="text-xs text-slate-400">{active && KIND_LABEL[active.kind]}</div>
      </div>
    );
  }
  return (
    <form ref={formRef} action={switchCompany}>
      <label htmlFor="company-switcher" className="sr-only">Active company</label>
      <select
        id="company-switcher"
        name="companyId"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {usable.map((c) => (
          <option key={c.company_id} value={c.company_id} className="text-slate-900">
            {c.name} ({c.kind === "carrier" ? "Carrier" : "Forwarder"})
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-1 text-xs text-slate-300 underline">Switch</button>
      </noscript>
    </form>
  );
}
