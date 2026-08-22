import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { localDb } from '@/lib/local-db';

type TableNames = keyof Database["public"]["Tables"];

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _real: ReturnType<typeof createSupabaseClient> | undefined;
function getReal() {
  if (!_real) _real = createSupabaseClient();
  return _real;
}

export const supabase = new Proxy({} as any, {
  get(_: any, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined;

    if (prop === 'auth') {
      if (localDb.isGuest()) return localDb.auth;
      return Reflect.get(getReal(), 'auth', getReal());
    }

    if (prop === 'from') {
      if (localDb.isGuest()) {
        return (table: TableNames) => localDb.from(table as any);
      }
      return (table: TableNames) => Reflect.get(getReal(), 'from', getReal())(table);
    }

    const real = getReal();
    return Reflect.get(real, prop, real);
  },
}) as ReturnType<typeof createSupabaseClient>;
