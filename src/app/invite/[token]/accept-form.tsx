"use client";
import { useActionState } from "react";
import { acceptInvitation } from "./actions";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" pendingText="Joining…">Accept and join</SubmitButton>
    </form>
  );
}
