"use client";
import { useActionState } from "react";
import { updateProfile } from "../actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfile, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.message}</Alert>}
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={fullName} required autoComplete="name" />
      </Field>
      <Field label="Phone" htmlFor="phone" hint="Optional. Shown to your teammates.">
        <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" maxLength={40} />
      </Field>
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
