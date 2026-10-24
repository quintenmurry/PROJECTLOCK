"use client";
import { useActionState } from "react";
import { resendInvitation } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { CopyLink } from "@/components/copy-link";

export function ResendButton({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState(resendInvitation, {});
  return (
    <form action={action} className="text-right">
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton variant="secondary" className="min-h-8 px-2.5" pendingText="Sending…">Resend</SubmitButton>
      {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
      {state.ok && !state.data?.link && <p className="mt-1 text-xs text-emerald-700">Sent.</p>}
      {state.data?.link && <div className="mt-1 max-w-xs text-left text-xs"><CopyLink link={state.data.link} /></div>}
    </form>
  );
}
