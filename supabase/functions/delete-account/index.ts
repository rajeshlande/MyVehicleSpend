// delete-account — Supabase Edge Function (FR-DATA-03). Deploy: supabase functions deploy delete-account
// Secrets: the service role key comes from the function environment (set with `supabase secrets set`), never the app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { deleteAccount, type AccountDeps } from './logic.ts';

const CORS = {
  // The function requires a bearer token, not cookies, so a permissive origin is safe.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'receipts';
const PAGE = 1000;
const BATCH = 100;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST.' }), {
      status: 405,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'The server is not configured.' }), {
      status: 500,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Every receipt object under {uid}/, including nested folders such as {uid}/{expense_id}/.
  async function listAll(prefix: string): Promise<string[]> {
    const out: string[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      const items = data ?? [];
      for (const item of items) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        // Folders come back with no id.
        if (item.id === null) out.push(...(await listAll(path)));
        else out.push(path);
      }
      if (items.length < PAGE) break;
    }
    return out;
  }

  const deps: AccountDeps = {
    async verifyJwt(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user) return null;
      return data.user.id;
    },
    listReceiptPaths: (uid) => listAll(uid),
    async removeReceiptPaths(paths) {
      for (let i = 0; i < paths.length; i += BATCH) {
        const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + BATCH));
        if (error) throw error;
      }
    },
    async deleteAuthUser(uid) {
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) throw error;
    },
  };

  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  const reply = await deleteAccount(
    { authorization: req.headers.get('authorization'), body },
    deps
  );
  return new Response(JSON.stringify(reply.body), {
    status: reply.status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
});
