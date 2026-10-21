import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OutgoingRow, Remote, RemoteRow } from './engine';

/**
 * Connexion à Supabase. Les deux valeurs viennent du fichier `.env.local`
 * (voir `.env.example`). La clé « anon / publishable » est publique par conception :
 * la sécurité repose sur les règles RLS de `supabase/schema.sql`.
 * Sans configuration, l'app fonctionne normalement, uniquement en local.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

const PAGE = 1000;

/** Table `records` de Supabase vue comme un `Remote` du moteur de synchronisation. */
export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async push(rows: OutgoingRow[]) {
      const { error } = await client.from('records').upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: 'user_id,table_name,id' },
      );
      if (error) throw new Error(error.message);
    },
    async pull(since: string | null) {
      const all: RemoteRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = client.from('records').select('table_name,id,data,deleted,updated_at').eq('user_id', userId);
        if (since) query = query.gt('updated_at', since);
        const { data, error } = await query.order('updated_at').order('id').range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        all.push(...(data as RemoteRow[]));
        if (data.length < PAGE) return all;
      }
    },
  };
}
