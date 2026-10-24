"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { beginUpload, finishUpload } from "@/app/(workspace)/shipments/actions";
import { browserClient } from "@/lib/supabase/browser";
import { ACCEPTED_FILES, DOC_LABEL, type DocumentType } from "@/lib/shipments";
import { cx } from "@/components/ui";

const EXT_MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp" };

function mimeOf(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/**
 * Uploads straight from the browser to private storage:
 * 1) the server reserves a path (permission checked in the database),
 * 2) the file goes to that path as the signed-in user (storage policy re-checks),
 * 3) the server confirms the file landed and logs it on the shipment.
 */
export function DocumentUploader({
  shipmentId, types, defaultType, replaces, label, large = false,
}: {
  shipmentId: string;
  types: DocumentType[];
  defaultType: DocumentType;
  replaces?: string;
  label?: string;
  large?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType>(defaultType);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null); setDone(null);
    let ok = 0;
    for (const file of Array.from(files)) {
      setBusy(`Uploading ${file.name}…`);
      const mime = mimeOf(file);
      const res = await beginUpload({ shipmentId, docType: type, fileName: file.name, mime, size: file.size, replaces: replaces ?? null });
      if ("error" in res && res.error) { setError(res.error); break; }
      const { documentId, path } = res as { documentId: string; path: string };
      const { error: upErr } = await browserClient().storage.from("shipment-documents").upload(path, file, { contentType: mime, upsert: false });
      if (upErr) { setError("The upload didn't go through. Check your connection and try again."); break; }
      const fin = await finishUpload(documentId, shipmentId);
      if ("error" in fin && fin.error) { setError(fin.error); break; }
      ok++;
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (ok) { setDone(ok === 1 ? `${DOC_LABEL[type]} uploaded.` : `${ok} files uploaded.`); router.refresh(); }
  }

  return (
    <div>
      <div className={cx("flex flex-wrap items-center gap-2", large && "flex-col items-stretch")}>
        {types.length > 1 && !replaces && (
          <select aria-label="Document type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}
            className={cx("rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100", large ? "min-h-12 text-base" : "min-h-9 py-1.5")}>
            {types.map((t) => <option key={t} value={t}>{DOC_LABEL[t]}</option>)}
          </select>
        )}
        <label className={cx(
          "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium",
          large ? "min-h-14 bg-brand-600 px-5 text-base text-white hover:bg-brand-700" : replaces ? "min-h-8 px-2 text-xs text-slate-600 hover:text-slate-900 hover:underline" : "min-h-9 border border-slate-300 bg-white px-3.5 text-sm text-slate-800 hover:bg-slate-50",
          busy && "pointer-events-none opacity-60",
        )}>
          <input ref={input} type="file" accept={ACCEPTED_FILES} multiple={!replaces} className="sr-only" disabled={!!busy}
            onChange={(e) => upload(e.target.files)} />
          {busy ? "Uploading…" : label ?? (replaces ? "Replace" : "Upload files")}
        </label>
      </div>
      <p aria-live="polite" className="mt-1.5 text-xs">
        {busy && <span className="text-slate-500">{busy}</span>}
        {error && <span className="text-red-700">{error}</span>}
        {done && <span className="text-emerald-700">{done}</span>}
      </p>
    </div>
  );
}
