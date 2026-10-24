"use client";
import { useActionState } from "react";
import { saveCarrierProfile } from "../carrier-actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Profile = {
  description: string; website: string | null; operating_hours: string; scac: string | null;
  usdot_number: string | null; mc_number: string | null; dispatch_email: string | null; dispatch_phone: string | null;
  insurance_provider: string | null; insurance_expires_on: string | null; listed: boolean;
} | null;

export function ProfileForm({ profile, readOnly }: { profile: Profile; readOnly: boolean }) {
  const [state, action] = useActionState(saveCarrierProfile, {});
  const p = profile;
  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.message}</Alert>}
      <fieldset disabled={readOnly} className="space-y-6">
        <Field label="About your company" htmlFor="description" hint="A few sentences: where you run, what you're good at, fleet size.">
          <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={p?.description ?? ""}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Operating hours" htmlFor="operatingHours" hint="e.g. Mon–Sat, 5am–9pm Pacific">
            <Input id="operatingHours" name="operatingHours" maxLength={200} defaultValue={p?.operating_hours ?? ""} />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" type="url" placeholder="https://" defaultValue={p?.website ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="SCAC" htmlFor="scac"><Input id="scac" name="scac" maxLength={4} className="uppercase" defaultValue={p?.scac ?? ""} /></Field>
          <Field label="USDOT number" htmlFor="usdot"><Input id="usdot" name="usdot" inputMode="numeric" maxLength={10} defaultValue={p?.usdot_number ?? ""} /></Field>
          <Field label="MC number" htmlFor="mc"><Input id="mc" name="mc" inputMode="numeric" maxLength={10} defaultValue={p?.mc_number ?? ""} /></Field>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Shared only with forwarders that approve you</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Dispatch email" htmlFor="dispatchEmail"><Input id="dispatchEmail" name="dispatchEmail" type="email" defaultValue={p?.dispatch_email ?? ""} /></Field>
            <Field label="Dispatch phone" htmlFor="dispatchPhone"><Input id="dispatchPhone" name="dispatchPhone" type="tel" maxLength={40} defaultValue={p?.dispatch_phone ?? ""} /></Field>
            <Field label="Insurance provider" htmlFor="insuranceProvider"><Input id="insuranceProvider" name="insuranceProvider" maxLength={200} defaultValue={p?.insurance_provider ?? ""} /></Field>
            <Field label="Insurance expires" htmlFor="insuranceExpires" hint="Certificate uploads arrive with document storage.">
              <Input id="insuranceExpires" name="insuranceExpires" type="date" defaultValue={p?.insurance_expires_on ?? ""} />
            </Field>
          </div>
        </div>

        <label className="flex items-start gap-3">
          <input type="checkbox" name="listed" defaultChecked={p?.listed ?? false} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm">
            <span className="font-medium text-slate-900">List my company in the carrier directory</span>
            <span className="block text-slate-500">Forwarders can find your profile and add you to their approved carriers. Forwarders you already work with can always see you.</span>
          </span>
        </label>
      </fieldset>
      {!readOnly && <SubmitButton pendingText="Saving…">Save profile</SubmitButton>}
    </form>
  );
}
