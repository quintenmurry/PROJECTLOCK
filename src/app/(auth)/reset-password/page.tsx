import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/session";
import { ResetForm } from "./reset-form";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPage() {
  const user = await getUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <div className="mt-6">
        {user ? (
          <ResetForm />
        ) : (
          <div className="space-y-4">
            <Alert>This reset link is invalid or has expired.</Alert>
            <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
