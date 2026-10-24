"use client";
import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "../actions";
import { Alert, Field, Input, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, {});
  if (state.ok)
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <Link href="/dashboard" className={buttonClass()}>Continue</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}
