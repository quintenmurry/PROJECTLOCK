-- Milestone 3: private file storage for shipment documents.
-- Applied on Supabase only (the local test database has no storage service).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipment-documents', 'shipment-documents', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload only to a path reserved by begin_document_upload for this user.
create or replace function public.can_upload_document_path(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shipment_documents d
     where d.storage_path = p_path and d.uploaded_by = (select auth.uid()) and not d.upload_complete
       and public.shipment_role(d.shipment_id) is not null
  );
$$;

-- Read (sign download URLs) only for documents the caller may see.
create or replace function public.can_read_document_path(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shipment_documents d
     where d.storage_path = p_path and (
       public.can_dispatch_shipment(d.shipment_id)
       or (public.shipment_role(d.shipment_id) = 'driver' and d.doc_type not in ('rate_confirmation', 'invoice'))
     )
  );
$$;

grant execute on function public.can_upload_document_path(text), public.can_read_document_path(text) to authenticated;

create policy "shipment documents: upload reserved path" on storage.objects for insert to authenticated
  with check (bucket_id = 'shipment-documents' and public.can_upload_document_path(name));

create policy "shipment documents: read permitted" on storage.objects for select to authenticated
  using (bucket_id = 'shipment-documents' and public.can_read_document_path(name));
