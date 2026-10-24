import Link from "next/link";
import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a link to choose a new one.</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <Link href="/login" className="mt-6 inline-block text-sm text-slate-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
