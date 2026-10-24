import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Free for carriers and owner-operators. You&apos;ll set up or join your company next.
      </p>
      <div className="mt-6">
        <SignupForm next={sp.next ?? ""} email={sp.email ?? ""} />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
