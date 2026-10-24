"use client";
import { useActionState } from "react";
import { signUp } from "../actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function SignupForm({ next, email }: { next: string; email: string }) {
  const [state, action] = useActionState(signUp, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={state.data?.fullName} />
      </Field>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.data?.email ?? email} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
