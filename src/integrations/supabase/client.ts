import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { localDb } from '@/lib/local-db';

type TableNames = keyof Database["public"]["Tables"];

const SUPABASE_URL = "https://fvwzycxpoanvcrmllvwq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2d3p5Y3hwb2FudmNybWxsdndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTU0NzksImV4cCI6MjEwMjk5MTQ3OX0.uBpk5FooDURbFwWlLsOJYuXPale-Yb0vbs8qQ6LEs9k";

// Create the real Supabase client immediately with hardcoded values
// so there's NEVER an initialization failure in the browser.
let _real: ReturnType<typeof createClient<Database>> | null = null;

function getReal() {
  if (!_real) {
    _real = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _real;
}

export const supabase = {
  get auth() {
    if (localDb.isGuest()) return localDb.auth as any;
    return getReal().auth;
  },
  from(table: TableNames) {
    if (localDb.isGuest()) {
      return localDb.from(table as any) as any;
    }
    return getReal().from(table);
  },
  storage: new Proxy({} as any, {
    get(_: any, prop: string) {
      return (getReal().storage as any)[prop];
    },
  }),
  functions: new Proxy({} as any, {
    get(_: any, prop: string) {
      return (getReal().functions as any)[prop];
    },
  }),
  realtime: new Proxy({} as any, {
    get(_: any, prop: string) {
      return (getReal().realtime as any)[prop];
    },
  }),
  channel: (...args: any[]) => getReal().channel(...args),
  removeChannel: (...args: any[]) => getReal().removeChannel(...args),
  removeAllChannels: () => getReal().removeAllChannels(),
  getChannels: () => getReal().getChannels(),
} as unknown as ReturnType<typeof createClient<Database>>;
