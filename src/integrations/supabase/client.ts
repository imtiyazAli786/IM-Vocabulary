import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { localDb } from '@/lib/local-db';

type TableNames = keyof Database["public"]["Tables"];

const DEFAULT_SUPABASE_URL = "https://fvwzycxpoanvcrmllvwq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2d3p5Y3hwb2FudmNybWxsdndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTU0NzksImV4cCI6MjEwMjk5MTQ3OX0.uBpk5FooDURbFwWlLsOJYuXPale-Yb0vbs8qQ6LEs9k";

function createSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ||
    DEFAULT_SUPABASE_ANON_KEY;

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
