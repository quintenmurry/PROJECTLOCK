import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).single();
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader title="Profile" description={profile?.email} />
          <div className="px-5 py-5"><ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} /></div>
        </Card>
        <Card>
          <CardHeader title="Password" />
          <div className="px-5 py-5"><PasswordForm /></div>
        </Card>
      </div>
    </>
  );
}
