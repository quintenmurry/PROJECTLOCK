import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back. Pick up where your team left off.</p>
      <div className="mt-6 space-y-4">
        {sp.error && <Alert>{sp.error}</Alert>}
        {sp.confirmed && <Alert tone="success">Email confirmed. Sign in to continue.</Alert>}
        <LoginForm next={sp.next ?? ""} email={sp.email ?? ""} />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        New here?{" "}
        <Link href={`/signup${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
