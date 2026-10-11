-- 0008_receipts_storage.sql : private receipts bucket and folder-based policies (T14).
-- FR-DATA-04, NFR-SEC-07, SDD §9. Object path: {user_id}/{expense_id}/{n}.{ext}.
-- The storage schema exists only on Supabase, so this block is skipped in the PGlite test harness.
-- The policy test (tests/db/storage.test.ts) runs the same block against a storage shim.

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present; skipping receipts bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('receipts', 'receipts', false)
  on conflict (id) do update set public = false;

  -- Only the first path folder decides access: it must equal the caller's uid.
  execute 'drop policy if exists "receipts owner select" on storage.objects';
  execute 'drop policy if exists "receipts owner insert" on storage.objects';
  execute 'drop policy if exists "receipts owner update" on storage.objects';
  execute 'drop policy if exists "receipts owner delete" on storage.objects';

  execute $p$create policy "receipts owner select" on storage.objects for select to authenticated
    using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "receipts owner insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "receipts owner update" on storage.objects for update to authenticated
    using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "receipts owner delete" on storage.objects for delete to authenticated
    using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  grant select, insert, update, delete on storage.objects to authenticated;
end $$;
