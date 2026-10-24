import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Signed-in download: checks access in the database, then redirects to a 2-minute signed URL. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));

  const { data: path } = await supabase.rpc("document_path_for_download", { p_document: id });
  if (!path) return new NextResponse("This document isn't available to you.", { status: 404 });
  const { data, error } = await supabase.storage
    .from("shipment-documents")
    .createSignedUrl(path as string, 120, { download: request.nextUrl.searchParams.get("download") === "1" });
  if (error || !data) return new NextResponse("Couldn't open the file. Try again.", { status: 500 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
