import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/session";
import { Alert, Logo, buttonClass } from "@/components/ui";
import { KIND_LABEL, ROLE_LABEL, ROLE_HELP, type CompanyKind, type MemberRole } from "@/lib/types";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Invitation" };

type Inv = { company_name: string; company_kind: CompanyKind; email: string; role: MemberRole; state: string; expires_at: string };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[a-f0-9]{64}$/.test(token);
  const supabase = await createClient();
  const { data } = valid ? await supabase.rpc("get_invitation", { p_token: token }) : { data: null };
  const inv = (data as Inv[] | null)?.[0];
  const user = await getUser();
  const here = `/invite/${token}`;

  let body: React.ReactNode;
  if (!inv) {
    body = <Alert>This invitation link isn&apos;t valid. Ask the person who invited you to send a new one.</Alert>;
  } else if (inv.state !== "pending") {
    const msg: Record<string, string> = {
      accepted: "This invitation has already been used.",
      revoked: "This invitation was cancelled. Ask for a new one.",
      expired: "This invitation has expired. Ask for a new one.",
      unavailable: "This company isn't available right now.",
    };
    body = (
      <div className="space-y-4">
        <Alert tone="warning">{msg[inv.state] ?? "This invitation can't be used."}</Alert>
        <Link href={user ? "/dashboard" : "/login"} className={buttonClass("secondary")}>{user ? "Go to workspace" : "Sign in"}</Link>
      </div>
    );
  } else if (!user) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Create an account with <strong>{inv.email}</strong>, or sign in if you already have one.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/signup?next=${encodeURIComponent(here)}&email=${encodeURIComponent(inv.email)}`} className={buttonClass()}>Create account</Link>
          <Link href={`/login?next=${encodeURIComponent(here)}&email=${encodeURIComponent(inv.email)}`} className={buttonClass("secondary")}>Sign in</Link>
        </div>
      </div>
    );
  } else if (user.email?.toLowerCase() !== inv.email) {
    body = (
      <div className="space-y-3">
        <Alert tone="warning">
          This invitation is for <strong>{inv.email}</strong>, but you&apos;re signed in as <strong>{user.email}</strong>.
        </Alert>
        <form action="/auth/signout" method="post">
          <button type="submit" className={buttonClass("secondary")}>Sign out and switch accounts</button>
        </form>
      </div>
    );
  } else {
    body = <AcceptForm token={token} />;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="px-6 py-5 text-brand-900"><Logo /></header>
      <main className="mx-auto max-w-md px-4 pt-6 sm:pt-16">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          {inv && (
            <div className="mb-5">
              <p className="text-sm text-slate-500">You&apos;re invited to join</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{inv.company_name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {KIND_LABEL[inv.company_kind]} · as <strong>{ROLE_LABEL[inv.role]}</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">{ROLE_HELP[inv.role]}</p>
            </div>
          )}
          {body}
        </div>
      </main>
    </div>
  );
}
