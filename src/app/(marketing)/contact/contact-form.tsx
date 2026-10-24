"use client";
import { useActionState } from "react";
import { submitInquiry } from "./actions";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const PLANS = ["Carrier Starter", "Carrier Professional", "Carrier Fleet", "Forwarder per shipment", "Not sure yet"];

export function ContactForm({ plan }: { plan: string }) {
  const [state, action] = useActionState(submitInquiry, {});
  const v = state.data ?? {};
  if (state.ok) {
    return (
      <div className="py-8 text-center">
        <h2 className="text-xl font-semibold text-brand-900">Thanks{v.name ? `, ${v.name}` : ""}. We&apos;ve got your request.</h2>
        <p className="mt-2 text-[15px] text-slate-600">We&apos;ll reply to the email you gave us.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="fullName"><Input id="fullName" name="fullName" autoComplete="name" required defaultValue={v.fullName} /></Field>
        <Field label="Work email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required defaultValue={v.email} /></Field>
        <Field label="Company" htmlFor="companyName"><Input id="companyName" name="companyName" autoComplete="organization" required defaultValue={v.companyName} /></Field>
        <Field label="Phone" htmlFor="phone" hint="Optional"><Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} /></Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Your company is a</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[["carrier", "Drayage carrier or owner-operator"], ["forwarder", "Forwarder or broker"], ["other", "Something else"]].map(([val, label]) => (
            <label key={val} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
              <input type="radio" name="companyType" value={val} required defaultChecked={v.companyType === val || (!v.companyType && plan.startsWith("Carrier") && val === "carrier") || (!v.companyType && plan.startsWith("Forwarder") && val === "forwarder")} className="text-brand-600" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Container moves per month" htmlFor="monthlyMoves">
          <Select id="monthlyMoves" name="monthlyMoves" defaultValue={v.monthlyMoves ?? ""}>
            <option value="">Choose a range</option>
            {["Under 50", "50–200", "200–1,000", "Over 1,000"].map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Interested in" htmlFor="planInterest">
          <Select id="planInterest" name="planInterest" defaultValue={v.planInterest ?? (PLANS.includes(plan) ? plan : "")}>
            <option value="">Choose a plan</option>
            {PLANS.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Anything we should know?" htmlFor="message" hint="Number of trucks, ports you run, how you handle PODs today.">
        <textarea id="message" name="message" rows={4} maxLength={4000} defaultValue={v.message}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
      </Field>
      <SubmitButton className="min-h-11 w-full sm:w-auto sm:px-6" pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}
