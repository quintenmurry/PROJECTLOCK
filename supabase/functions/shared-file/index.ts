// Downloads for customer share links. The recipient has no account, so this function checks the
// share token against the database (service role) and, if the link is live and the document is
// shared, redirects to a short-lived signed URL. Every download is recorded on the shipment.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function text(status: number, body: string) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return text(405, "Method not allowed");
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const doc = url.searchParams.get("d") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(doc)) return text(400, "This link is not valid.");

  const { data: path, error } = await supabase.rpc("resolve_shared_document", { p_token: token, p_document: doc });
  if (error) {
    console.error("resolve_shared_document failed", error);
    return text(500, "Something went wrong. Try again in a minute.");
  }
  if (!path) return text(404, "This document is no longer available. Ask the carrier for a new link.");

  const { data: signed, error: signError } = await supabase.storage
    .from("shipment-documents")
    .createSignedUrl(path as string, 60, { download: url.searchParams.get("download") === "1" });
  if (signError || !signed) {
    console.error("createSignedUrl failed", signError);
    return text(500, "Something went wrong. Try again in a minute.");
  }
  return new Response(null, { status: 302, headers: { Location: signed.signedUrl, "Cache-Control": "no-store" } });
});
