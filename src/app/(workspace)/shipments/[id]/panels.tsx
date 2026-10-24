"use client";
import { useActionState, useRef, useEffect } from "react";
import { addNote, createShareLink, setException } from "../actions";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyLink } from "@/components/copy-link";

export function NoteForm({ shipmentId, placeholder = "Add a note for your team" }: { shipmentId: string; placeholder?: string }) {
  const [state, action] = useActionState(addNote, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <label htmlFor="note-body" className="sr-only">Note</label>
      <textarea id="note-body" name="body" rows={2} maxLength={2000} required placeholder={placeholder}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Notes are internal. Customers never see them.</span>
        <SubmitButton variant="secondary" className="min-h-8 px-3" pendingText="Adding…">Add note</SubmitButton>
      </div>
    </form>
  );
}

export function ShareForm({ shipmentId, defaultLabel }: { shipmentId: string; defaultLabel: string }) {
  const [state, action] = useActionState(createShareLink, {});
  return (
    <form action={action} className="space-y-3" key={state.data?.link ?? "form"}>
      <input type="hidden" name="shipmentId" value={shipmentId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && state.data?.link && (
        <Alert tone="success">
          {state.message}
          <CopyLink link={state.data.link} />
        </Alert>
      )}
      <Field label="Who is it for?" htmlFor="share-label">
        <Input id="share-label" name="label" required maxLength={120} defaultValue={defaultLabel} placeholder="e.g. Harborline Forwarding" />
      </Field>
      <Field label="Email it to (optional)" htmlFor="share-email">
        <Input id="share-email" name="email" type="email" placeholder="ops@customer.com" />
      </Field>
      <Field label="Link works for" htmlFor="share-days">
        <Select id="share-days" name="days" defaultValue="30">
          <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option>
        </Select>
      </Field>
      <SubmitButton className="w-full" pendingText="Creating…">Create share link</SubmitButton>
    </form>
  );
}

export function ExceptionForm({ shipmentId, open, note, canResolve }: { shipmentId: string; open: boolean; note: string | null; canResolve: boolean }) {
  const [state, action] = useActionState(setException, {});
  if (open) {
    return (
      <form action={action} className="space-y-3">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="open" value="0" />
        <p className="text-sm text-red-800">{note}</p>
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
        {canResolve && <SubmitButton variant="secondary" className="min-h-8 px-3" pendingText="Saving…">Mark resolved</SubmitButton>}
      </form>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="open" value="1" />
      {state.ok && <p className="text-xs text-emerald-700">{state.message}</p>}
      <label htmlFor="exc-note" className="sr-only">What's wrong?</label>
      <Input id="exc-note" name="note" maxLength={1000} placeholder="e.g. Terminal hold, chassis flat, appointment missed" />
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      <SubmitButton variant="danger" className="min-h-8 px-3" pendingText="Saving…">Report a problem</SubmitButton>
    </form>
  );
}
