"use client";
import { useActionState } from "react";
import { saveCarrierNote } from "../../carrier-actions";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function NoteForm({ carrierId, note, readOnly }: { carrierId: string; note: string; readOnly: boolean }) {
  const [state, action] = useActionState(saveCarrierNote, {});
  if (readOnly) return <p className="whitespace-pre-line text-sm text-slate-700">{note || <span className="text-slate-400">No note yet.</span>}</p>;
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.message}</Alert>}
      <input type="hidden" name="carrierId" value={carrierId} />
      <label htmlFor="note" className="sr-only">Internal note</label>
      <textarea id="note" name="note" rows={3} maxLength={1000} defaultValue={note} placeholder="e.g. Reliable on LGB turns; prefers 24h notice for prepulls"
        className="block w-full rounded-md border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
      <SubmitButton variant="secondary" pendingText="Saving…">Save note</SubmitButton>
    </form>
  );
}
