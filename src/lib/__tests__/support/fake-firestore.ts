// In-memory Firestore double, shared by the subscribers and subscribe-route
// tests. Not a *.test.ts file, so the runner's glob does not pick it up.
//
// Supports exactly the surface those two paths use: collection().doc(),
// runTransaction with tx.get/set/update, ref.update(), and
// where().limit().get() for the token lookups.
//
// FIDELITY CAVEAT: writes apply immediately rather than buffering to commit.
// upsertSubscriber and checkSubscribeRateLimit each perform a single read at the
// top of their transaction and never read back, so the difference is not
// observable. It would matter if either grew a read-after-write.

export type Data = Record<string, unknown>;
export type WriteCall = { op: 'set' | 'update'; collection: string; doc: string; data: Data };
export type DocRef = {
  __collection: string;
  __id: string;
  id: string;
  update(data: Data): Promise<void>;
};

export const state = {
  store: new Map<string, Map<string, Data>>(),
  writes: [] as WriteCall[],
  // Set to make the next ref.update() reject, exercising second-write failure
  // handling. Only affects the non-transactional path.
  failNextUpdate: null as Error | null,
};

export function resetFirestore(): void {
  state.store = new Map();
  state.writes = [];
  state.failNextUpdate = null;
}

export function coll(name: string): Map<string, Data> {
  let c = state.store.get(name);
  if (!c) {
    c = new Map();
    state.store.set(name, c);
  }
  return c;
}

export function lastWrite(): WriteCall {
  if (state.writes.length === 0) throw new Error('expected at least one write');
  return state.writes[state.writes.length - 1];
}

export function writesTo(collection: string): WriteCall[] {
  return state.writes.filter((w) => w.collection === collection);
}

function applyWrite(op: 'set' | 'update', collection: string, id: string, data: Data): void {
  const c = coll(collection);
  c.set(id, op === 'set' ? { ...data } : { ...(c.get(id) ?? {}), ...data });
  state.writes.push({ op, collection, doc: id, data });
}

function makeRef(collection: string, id: string): DocRef {
  return {
    __collection: collection,
    __id: id,
    id,
    async update(data: Data) {
      if (state.failNextUpdate) {
        const e = state.failNextUpdate;
        state.failNextUpdate = null;
        throw e;
      }
      applyWrite('update', collection, id, data);
    },
  };
}

function snapFor(collection: string, id: string) {
  const data = coll(collection).get(id);
  return {
    id,
    exists: data !== undefined,
    data: () => data,
    ref: makeRef(collection, id),
  };
}

function makeQuery(collection: string, field: string, value: unknown) {
  let cap = Infinity;
  const q = {
    limit(n: number) {
      cap = n;
      return q;
    },
    async get() {
      const docs = [...coll(collection).entries()]
        .filter(([, d]) => d[field] === value)
        .slice(0, cap)
        .map(([id]) => snapFor(collection, id));
      return { empty: docs.length === 0, docs };
    },
  };
  return q;
}

type FakeTx = {
  get(ref: DocRef): Promise<ReturnType<typeof snapFor>>;
  set(ref: DocRef, data: Data): void;
  update(ref: DocRef, data: Data): void;
};

export const fakeDb = {
  collection(name: string) {
    return {
      doc(id: string) {
        return makeRef(name, id);
      },
      where(field: string, _op: string, value: unknown) {
        return makeQuery(name, field, value);
      },
    };
  },
  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    const tx: FakeTx = {
      async get(ref: DocRef) {
        return snapFor(ref.__collection, ref.__id);
      },
      set(ref: DocRef, data: Data) {
        applyWrite('set', ref.__collection, ref.__id, data);
      },
      update(ref: DocRef, data: Data) {
        applyWrite('update', ref.__collection, ref.__id, data);
      },
    };
    return fn(tx);
  },
};
