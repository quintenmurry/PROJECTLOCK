"use client";
import { useActionState, useRef, useEffect, useState } from "react";
import { addNote, createShareLink, sendDispatch, setException } from "../actions";
import { Alert, Field, Input, Select, buttonClass } from "@/components/ui";
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

type DispatchDoc = { id: string; label: string; file: string; preselect: boolean; private: boolean };
type DispatchDriver = { user_id: string; full_name: string; email: string };

export function DispatchForm({ shipmentId, drivers, docs, currentDriver }: { shipmentId: string; drivers: DispatchDriver[]; docs: DispatchDoc[]; currentDriver: string | null }) {
  const [state, action] = useActionState(sendDispatch, {});
  const [target, setTarget] = useState(currentDriver ?? (drivers[0]?.user_id ?? "other"));
  if (state.ok && state.data?.link) {
    return (
      <div className="space-y-3">
        <Alert tone="success">{state.message}<CopyLink link={state.data.link} /></Alert>
        <div className="flex flex-wrap gap-2">
          <a href={state.data.sms} className={buttonClass("secondary", "min-h-8 px-3")}>Text the link</a>
          <button type="button" onClick={() => window.location.reload()} className={buttonClass("ghost", "min-h-8 px-3")}>Done</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Trucker" htmlFor="dispatch-target">
        <Select id="dispatch-target" name="target" value={target} onChange={(e) => setTarget(e.target.value)}>
          {drivers.map((d) => <option key={d.user_id} value={d.user_id}>{d.full_name || d.email} (your driver)</option>)}
          <option value="other">Someone else (outside trucker)</option>
        </Select>
      </Field>
      {target === "other" ? (
        <>
          <Field label="Name" htmlFor="dispatch-name"><Input id="dispatch-name" name="name" maxLength={120} required placeholder="e.g. Joe Ramirez" /></Field>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Email" htmlFor="dispatch-email"><Input id="dispatch-email" name="email" type="email" placeholder="Optional" /></Field>
            <Field label="Mobile" htmlFor="dispatch-phone"><Input id="dispatch-phone" name="phone" type="tel" placeholder="Optional, for texting" /></Field>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500">Sent to {drivers.find((d) => d.user_id === target)?.email}. They&apos;ll also see it under My loads.</p>
          <Field label="Mobile" htmlFor="dispatch-phone"><Input id="dispatch-phone" name="phone" type="tel" placeholder="Optional, for texting" /></Field>
        </>
      )}
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Documents to send</legend>
        {docs.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No paperwork uploaded yet. Upload the DO first if the trucker needs it.</p>
        ) : (
          <div className="mt-1.5 space-y-1.5">
            {docs.map((d) => (
              <label key={d.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="doc" value={d.id} defaultChecked={d.preselect} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">{d.label}</span>
                  {d.private && <span className="ml-1 text-xs text-amber-700">(private to your company)</span>}
                  <span className="block truncate text-xs text-slate-500">{d.file}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <Field label="Note to the trucker" htmlFor="dispatch-message">
        <textarea id="dispatch-message" name="message" rows={2} maxLength={1000} placeholder="e.g. Use gate 4, call 30 min before delivery"
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
      </Field>
      <input type="hidden" name="days" value="14" />
      <SubmitButton className="w-full" pendingText="Sending…">Send dispatch</SubmitButton>
      <p className="text-xs text-slate-500">They get a secure link to this load and only the documents you tick. It works for 14 days and you can turn it off.</p>
    </form>
  );
}
