"use client";
import { useActionState } from "react";
import { updateCompany } from "../../actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function CompanyForm({ name, legalName, readOnly }: { name: string; legalName: string; readOnly: boolean }) {
  const [state, action] = useActionState(updateCompany, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.message}</Alert>}
      <Field label="Company name" htmlFor="name" hint="How your company appears to partners.">
        <Input id="name" name="name" defaultValue={name} required minLength={2} maxLength={120} disabled={readOnly} />
      </Field>
      <Field label="Legal business name" htmlFor="legalName" hint="Optional. Used on documents and invoices later.">
        <Input id="legalName" name="legalName" defaultValue={legalName} maxLength={200} disabled={readOnly} />
      </Field>
      {!readOnly && <SubmitButton pendingText="Saving…">Save changes</SubmitButton>}
    </form>
  );
}
