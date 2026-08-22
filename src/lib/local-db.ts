const DB_KEY = "lafz_local_data";
const GUEST_KEY = "lafz_guest_id";

type Tables = "words" | "profiles" | "quiz_sessions" | "reviews" | "grammar_attempts";

interface LocalDB {
  words: Record<string, any>[];
  profiles: Record<string, any>[];
  quiz_sessions: Record<string, any>[];
  reviews: Record<string, any>[];
  grammar_attempts: Record<string, any>[];
}

function getDB(): LocalDB {
  const defaults: LocalDB = {
    words: [],
    profiles: [],
    quiz_sessions: [],
    reviews: [],
    grammar_attempts: [],
  };
  try {
    if (typeof window === "undefined") return defaults;
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const db = {
        ...defaults,
        ...parsed,
      };
      // Auto-initialize default profile for guest to allow updates (streaks) to succeed
      const guestId = localStorage.getItem(GUEST_KEY);
      if (guestId && db.profiles.length === 0) {
        db.profiles.push({
          id: guestId,
          display_name: "Guest User",
          current_streak: 0,
          longest_streak: 0,
          last_study_date: null,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      }
      return db;
    }
  } catch {}
  return defaults;
}

function saveDB(db: LocalDB) {
  if (typeof window !== "undefined") {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
}

function genId() {
  return crypto.randomUUID();
}

// ── Query builder ──────────────────────────────────────────────

class LocalQuery {
  private table: Tables;
  private filters: Array<(r: any) => boolean> = [];
  private sortField = "";
  private sortAsc = true;
  private limitN = 0;
  private columns = "*";
  private opts: { count?: "exact"; head?: boolean } = {};
  private offsetN = 0;

  constructor(table: Tables, columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.table = table;
    this.columns = columns;
    this.opts = opts ?? {};
  }

  eq(field: string, value: any) {
    this.filters.push((r: any) => r[field] === value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push((r: any) => r[field] <= value);
    return this;
  }

  not(field: string, _op: string, value: any) {
    this.filters.push((r: any) => r[field] !== value);
    return this;
  }

  order(field: string, { ascending }: { ascending: boolean } = { ascending: true }) {
    this.sortField = field;
    this.sortAsc = ascending;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  offset(n: number) {
    this.offsetN = n;
    return this;
  }

  or(expr: string) {
    const clauses = expr.split(",");
    const parsedClauses = clauses.map((c) => {
      const parts = c.split(".");
      const field = parts[0]?.trim();
      const op = parts[1]?.trim();
      let val = parts[2]?.trim() || "";
      if (op === "ilike") {
        if (val.startsWith("%")) val = val.slice(1);
        if (val.endsWith("%")) val = val.slice(0, -1);
      }
      return { field, op, val };
    });

    this.filters.push((r: any) => {
      return parsedClauses.some(({ field, op, val }) => {
        const itemVal = String(r[field] || "").toLowerCase();
        const searchVal = val.toLowerCase();
        if (op === "ilike") {
          return itemVal.includes(searchVal);
        }
        return itemVal === searchVal;
      });
    });
    return this;
  }

  contains(field: string, values: any[]) {
    this.filters.push((r: any) => {
      const arr = r[field];
      if (!Array.isArray(arr)) return false;
      return values.every((v) => arr.includes(v));
    });
    return this;
  }

  single() {
    return this._execSingle();
  }

  maybeSingle() {
    return this._execMaybeSingle();
  }

  then(resolve: (v: any) => any) {
    return this._execAll().then(resolve);
  }

  private _applyFilters(rows: any[]) {
    return this.filters.length ? rows.filter((r) => this.filters.every((f) => f(r))) : rows;
  }

  private _applySort(rows: any[]) {
    if (!this.sortField) return rows;
    return [...rows].sort((a: any, b: any) =>
      this.sortAsc
        ? a[this.sortField] > b[this.sortField]
          ? 1
          : -1
        : a[this.sortField] < b[this.sortField]
          ? 1
          : -1,
    );
  }

  private async _execAll() {
    const db = getDB();
    let rows = db[this.table] || [];
    rows = this._applyFilters(rows);
    rows = this._applySort(rows);
    const count = this.opts.count === "exact" ? rows.length : undefined;
    if (this.offsetN > 0) rows = rows.slice(this.offsetN);
    if (this.limitN > 0) rows = rows.slice(0, this.limitN);
    return { data: rows, error: null, count };
  }

  private async _execSingle() {
    const db = getDB();
    const rows = this._applyFilters(db[this.table] || []);
    const row = rows[0] ?? null;
    return { data: row, error: row ? null : new Error("Not found") };
  }

  private async _execMaybeSingle() {
    const db = getDB();
    const rows = this._applyFilters(db[this.table] || []);
    return { data: rows[0] ?? null, error: null };
  }
}

// ── Insert builder ─────────────────────────────────────────────

class LocalInsert {
  private table: Tables;
  private rows: any[];

  constructor(table: Tables, rows: any | any[]) {
    this.table = table;
    this.rows = Array.isArray(rows) ? rows : [rows];
  }

  select() {
    return { single: async () => this._execSingle() };
  }

  then(resolve: (v: any) => any) {
    return this._execAll().then(resolve);
  }

  private async _execAll() {
    const db = getDB();
    const inserted: any[] = [];
    for (const row of this.rows) {
      let entry = { ...row, id: row.id || genId() };
      if (this.table === "words") {
        entry = {
          created_at: new Date().toISOString(),
          due_at: new Date().toISOString(),
          ease: 2.5,
          interval_days: 0,
          repetitions: 0,
          mastered: false,
          tags: [],
          collocations: [],
          examples: [],
          ...entry,
        };
      } else if (this.table === "quiz_sessions") {
        entry = {
          completed_at: new Date().toISOString(),
          ...entry,
        };
      } else if (this.table === "reviews") {
        entry = {
          created_at: new Date().toISOString(),
          ...entry,
        };
      }
      db[this.table].push(entry);
      inserted.push(entry);
    }
    saveDB(db);
    return { data: inserted, error: null };
  }

  private async _execSingle() {
    const db = getDB();
    const inserted: any[] = [];
    for (const row of this.rows) {
      let entry = { ...row, id: row.id || genId() };
      if (this.table === "words") {
        entry = {
          created_at: new Date().toISOString(),
          due_at: new Date().toISOString(),
          ease: 2.5,
          interval_days: 0,
          repetitions: 0,
          mastered: false,
          tags: [],
          collocations: [],
          examples: [],
          ...entry,
        };
      } else if (this.table === "quiz_sessions") {
        entry = {
          completed_at: new Date().toISOString(),
          ...entry,
        };
      } else if (this.table === "reviews") {
        entry = {
          created_at: new Date().toISOString(),
          ...entry,
        };
      }
      db[this.table].push(entry);
      inserted.push(entry);
    }
    saveDB(db);
    return { data: inserted[0], error: null };
  }
}

// ── Update builder ─────────────────────────────────────────────

class LocalUpdate {
  private table: Tables;
  private updates: Record<string, any>;
  private filter: ((r: any) => boolean) | null = null;

  constructor(table: Tables, updates: Record<string, any>) {
    this.table = table;
    this.updates = updates;
  }

  eq(field: string, value: any) {
    this.filter = (r: any) => r[field] === value;
    return this;
  }

  then(resolve: (v: any) => any) {
    return this._exec().then(resolve);
  }

  private async _exec() {
    const db = getDB();
    const updated: any[] = [];
    db[this.table] = db[this.table].map((r: any) => {
      if (this.filter && !this.filter(r)) return r;
      const merged = { ...r, ...this.updates };
      updated.push(merged);
      return merged;
    });
    saveDB(db);
    return { data: updated, error: null };
  }
}

// ── Delete builder ─────────────────────────────────────────────

class LocalDelete {
  private table: Tables;
  private filter: ((r: any) => boolean) | null = null;

  constructor(table: Tables) {
    this.table = table;
  }

  eq(field: string, value: any) {
    this.filter = (r: any) => r[field] === value;
    return this;
  }

  then(resolve: (v: any) => any) {
    return this._exec().then(resolve);
  }

  private async _exec() {
    const db = getDB();
    db[this.table] = db[this.table].filter((r: any) => !(this.filter && this.filter(r)));
    saveDB(db);
    return { data: [], error: null };
  }
}

// ── Public API ─────────────────────────────────────────────────

function getGuestId() {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
  } catch {
    return null;
  }
}

function clearGuestData() {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(DB_KEY);
    }
  } catch {}
}

const _auth = {
  getUser: async () => {
    const id = getGuestId();
    if (id) return { data: { user: { id } }, error: null };
    return { data: { user: null }, error: new Error("No guest session") };
  },
  getSession: async () => {
    const id = getGuestId();
    if (id) return { data: { session: { user: { id } } }, error: null };
    return { data: { session: null }, error: null };
  },
  signOut: async () => {
    clearGuestData();
    return { error: null };
  },
  onAuthStateChange: (_cb: (event: string, session: any) => void) => {
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

export const localDb = {
  isGuest: () => {
    try {
      return typeof window !== "undefined" && !!localStorage.getItem(GUEST_KEY);
    } catch {
      return false;
    }
  },
  auth: _auth,
  from: (table: Tables) => ({
    select: (columns = "*", opts?: { count?: "exact"; head?: boolean }) =>
      new LocalQuery(table, columns, opts),
    insert: (rows: any | any[]) => new LocalInsert(table, rows),
    update: (updates: Record<string, any>) => new LocalUpdate(table, updates),
    delete: () => new LocalDelete(table),
  }),
};
