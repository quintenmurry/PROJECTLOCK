"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm({ next, email }: { next: string; email: string }) {
  const [state, action] = useActionState(signIn, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.data?.email ?? email} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex items-center justify-between">
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        <Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
