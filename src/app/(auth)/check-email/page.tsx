import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmail({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { email } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
      <p className="mt-3 text-sm text-slate-600">
        We sent a confirmation link to <strong className="text-slate-900">{email ?? "your inbox"}</strong>. Open it on this
        device to finish creating your account.
      </p>
      <p className="mt-3 text-sm text-slate-500">Didn&apos;t get it? Check spam, or wait a minute before trying again.</p>
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
