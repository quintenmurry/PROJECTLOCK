"use client";
import { useActionState, useState } from "react";
import { createCompany } from "@/app/(workspace)/actions";
import { Alert, Field, Input, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const kinds = [
  { value: "forwarder", title: "Freight forwarder", body: "I send container moves to drayage carriers and need to track them." },
  { value: "carrier", title: "Drayage carrier", body: "I receive moves from forwarders and dispatch them to my drivers." },
] as const;

export function OnboardingForm() {
  const [state, action] = useActionState(createCompany, {});
  const [kind, setKind] = useState<string>("");
  return (
    <form action={action} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
      {state.error && <Alert>{state.error}</Alert>}
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">What kind of company is this?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {kinds.map((k) => (
            <label
              key={k.value}
              className={cx(
                "cursor-pointer rounded-lg border p-4 text-sm has-focus-visible:ring-2 has-focus-visible:ring-brand-500",
                kind === k.value ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input type="radio" name="kind" value={k.value} className="sr-only" required onChange={() => setKind(k.value)} />
              <span className="block font-semibold text-slate-900">{k.title}</span>
              <span className="mt-1 block text-slate-600">{k.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Company name" htmlFor="name">
        <Input id="name" name="name" required minLength={2} maxLength={120} placeholder="e.g. Red River Drayage" />
      </Field>
      <Field label="Legal business name" htmlFor="legalName" hint="Optional. You can add this later.">
        <Input id="legalName" name="legalName" maxLength={200} />
      </Field>
      <SubmitButton pendingText="Creating…">Create company</SubmitButton>
      <p className="text-xs text-slate-500">You&apos;ll be the owner. You can invite your team right after.</p>
    </form>
  );
}
