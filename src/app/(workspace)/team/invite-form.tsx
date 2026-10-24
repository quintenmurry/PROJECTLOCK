"use client";
import { useActionState } from "react";
import { inviteMember } from "../actions";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_HELP, ROLE_LABEL, type MemberRole } from "@/lib/types";
import { CopyLink } from "@/components/copy-link";

export function InviteForm({ roles }: { roles: MemberRole[] }) {
  const [state, action] = useActionState(inviteMember, {});
  const defaultRole = roles.includes("dispatcher") ? "dispatcher" : roles.includes("member") ? "member" : roles[0];
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && (
        <Alert tone={state.data?.link ? "warning" : "success"}>
          {state.message}
          {state.data?.link && <CopyLink link={state.data.link} />}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <Field label="Email" htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required placeholder="name@company.com" key={state.ok ? "reset" : "keep"} defaultValue={state.ok ? "" : state.data?.email} />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <Select id="invite-role" name="role" defaultValue={defaultRole}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <SubmitButton pendingText="Sending…">Send invite</SubmitButton>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
        {roles.map((r) => (
          <div key={r}><dt className="inline font-medium text-slate-700">{ROLE_LABEL[r]}:</dt> <dd className="inline">{ROLE_HELP[r]}</dd></div>
        ))}
      </dl>
    </form>
  );
}
