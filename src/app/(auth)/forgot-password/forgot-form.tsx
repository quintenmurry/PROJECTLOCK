"use client";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, {});
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
