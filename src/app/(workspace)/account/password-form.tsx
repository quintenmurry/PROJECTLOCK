"use client";
import { useActionState } from "react";
import { updatePassword } from "@/app/(auth)/actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, {});
  return (
    <form action={action} className="space-y-4" key={state.ok ? "done" : "form"}>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.message}</Alert>}
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton variant="secondary" pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
