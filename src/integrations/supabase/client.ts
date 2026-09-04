type RuntimeAppConfig = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseProjectId?: string;
};

type AuthUser = {
  id: string;
  email: string;
};

type AuthSession = {
  access_token: string;
  user: AuthUser;
};

type AuthenticatedUser = AuthUser & {
  profile?: {
    full_name: string;
    phone?: string;
    avatar_url?: string;
    branch_id: string;
  };
  roles?: string[];
};

type QueryFilter =
  | { field: string; operator: 'eq'; value: unknown }
  | { field: string; operator: 'neq'; value: unknown }
  | { field: string; operator: 'like'; value: unknown }
  | { field: string; operator: 'in'; value: unknown[] }
  | { field: string; operator: 'not'; comparator: string; value: unknown };

type QueryOrder = {
  field: string;
  ascending?: boolean;
};

type ApiError = {
  message: string;
};

type ApiResult<T> = {
  data: T | null;
  error: ApiError | null;
};

const runtimeConfig =
  typeof window !== 'undefined'
    ? (window as Window & { __APP_CONFIG__?: RuntimeAppConfig }).__APP_CONFIG__
    : undefined;

const API_BASE_URL = (
  runtimeConfig?.apiBaseUrl ||
  import.meta.env.VITE_API_BASE_URL ||
  '/api'
).replace(/\/+$/, '');

const SESSION_STORAGE_KEY = 'oasis.auth.session';

const listeners = new Set<(event: string, session: AuthSession | null) => void>();

function readStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return;

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

let currentSession: AuthSession | null = readStoredSession();

function emitAuth(event: string, session: AuthSession | null) {
  currentSession = session;
  writeStoredSession(session);
  listeners.forEach((listener) => listener(event, session));
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; rawBody?: boolean } = {}
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers || {});
  const token = currentSession?.access_token;

  if (!options.rawBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || payload?.message || 'Request failed';

      if (response.status === 401) {
        emitAuth('SIGNED_OUT', null);
      }

      return {
        data: null,
        error: { message },
      };
    }

    return {
      data: (payload?.data ?? payload) as T,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Network error' },
    };
  }
}

class QueryBuilder<T = any> implements PromiseLike<ApiResult<T>> {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private filters: QueryFilter[] = [];
  private orderClause: QueryOrder | null = null;
  private rowLimit: number | null = null;
  private payload: any = null;
  private expectSingle = false;
  private allowNullSingle = false;

  constructor(private readonly table: string) {}

  select(columns = '*') {
    // .insert().select() or .update().select() = "return rows after mutation"
    // Keep the mutation action so the server actually performs the write.
    if (this.action !== 'insert' && this.action !== 'update') {
      this.action = 'select';
    }
    this.columns = columns;
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'neq', value });
    return this;
  }

  like(field: string, value: unknown) {
    this.filters.push({ field, operator: 'like', value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, operator: 'in', value });
    return this;
  }

  // توافق مع أسلوب Supabase التقليدي: .match({ a: 1, b: 'x' })
  match(criteria: Record<string, unknown>) {
    Object.entries(criteria || {}).forEach(([field, value]) => {
      this.filters.push({ field, operator: 'eq', value });
    });
    return this;
  }

  not(field: string, comparator: string, value: unknown) {
    this.filters.push({ field, operator: 'not', comparator, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderClause = { field, ascending: options?.ascending };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    this.allowNullSingle = true;
    return this;
  }

  private async execute(): Promise<ApiResult<any>> {
    const result = await apiRequest<any>(`/query/${this.table}/${this.action}`, {
      method: 'POST',
      body: JSON.stringify({
        columns: this.columns,
        filters: this.filters,
        order: this.orderClause,
        limit: this.rowLimit,
        values: this.payload,
      }),
    });

    if (result.error) {
      return result;
    }

    if (!this.expectSingle) {
      return result;
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    const row = rows[0] ?? null;

    if (!row && !this.allowNullSingle) {
      return {
        data: null,
        error: { message: 'Expected a single row' },
      };
    }

    return {
      data: row,
      error: null,
    };
  }

  then<TResult1 = ApiResult<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const auth = {
  async getSession() {
    if (!currentSession) {
      return { data: { session: null }, error: null };
    }

    const me = await apiRequest<{ user: AuthenticatedUser }>('/auth/me');
    if (me.error || !me.data?.user) {
      emitAuth('SIGNED_OUT', null);
      return { data: { session: null }, error: me.error };
    }

    currentSession = {
      access_token: currentSession.access_token,
      user: { id: me.data.user.id, email: me.data.user.email },
    };
    writeStoredSession(currentSession);

    return { data: { session: currentSession }, error: null };
  },

  async getUser() {
    const sessionResult = await this.getSession();
    return {
      data: { user: sessionResult.data.session?.user ?? null },
      error: sessionResult.error,
    };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await apiRequest<{ token: string; user: AuthenticatedUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      { auth: false }
    );

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const session = {
      access_token: result.data.token,
      user: { id: result.data.user.id, email: result.data.user.email },
    };

    emitAuth('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },

  async signUp(payload: {
    email: string;
    password: string;
    options?: {
      data?: {
        full_name?: string;
        role?: 'admin' | 'sales_rep' | 'customer_service' | 'warehouse_keeper';
        branch_id?: string;
        phone?: string;
      };
    };
  }) {
    const result = await apiRequest<{ token: string; user: AuthenticatedUser }>(
      '/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: false }
    );

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const session = {
      access_token: result.data.token,
      user: { id: result.data.user.id, email: result.data.user.email },
    };

    emitAuth('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },

  async signOut() {
    await apiRequest('/auth/logout', { method: 'POST' });
    emitAuth('SIGNED_OUT', null);
    return { error: null };
  },

  async verifyDeletePassword(password: string) {
    return apiRequest<{ ok: boolean }>('/auth/verify-delete-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};

const storage = {
  from(bucket: string) {
    return {
      async upload(_path: string, file: File) {
        const body = new FormData();
        body.append('file', file);
        body.append('path', _path);

        const result = await apiRequest<{ path: string; fullPath: string; publicUrl: string }>(
          `/storage/${bucket}/upload`,
          {
            method: 'POST',
            body,
          },
          { rawBody: true }
        );

        return result;
      },

      getPublicUrl(path: string) {
        const sanitizedPath = path.replace(/^\/+/, '');
        const publicUrl = `${API_BASE_URL.replace(/\/api$/, '')}/uploads/${bucket}/${sanitizedPath}`;
        return {
          data: {
            publicUrl,
          },
        };
      },
    };
  },
};

const functions = {
  async invoke(name: string, { body }: { body?: Record<string, unknown> } = {}) {
    return apiRequest<any>(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
  },
};

type RealtimeChannel = {
  subscribe: () => RealtimeChannel;
  on: (_event: string, _filter: Record<string, unknown>, callback: () => void) => RealtimeChannel;
  __intervalId?: number;
  __callbacks: Array<() => void>;
};

function createChannel(): RealtimeChannel {
  return {
    __callbacks: [],
    on(_event, _filter, callback) {
      this.__callbacks.push(callback);
      return this;
    },
    subscribe() {
      this.__intervalId = window.setInterval(() => {
        this.__callbacks.forEach((callback) => callback());
      }, 15000);
      return this;
    },
  };
}

export const supabase = {
  auth,
  storage,
  functions,
  from(table: string) {
    return new QueryBuilder(table);
  },
  channel(_name: string) {
    return createChannel();
  },
  removeChannel(channel: RealtimeChannel) {
    if (channel.__intervalId) {
      window.clearInterval(channel.__intervalId);
    }
  },
};

export const authApi = {
  async getSetupStatus() {
    return apiRequest<{ needsSetup: boolean }>('/auth/setup-status', { method: 'GET' }, { auth: false });
  },

  async setupAdmin(payload: { email: string; password: string; full_name: string; branch_id: string }) {
    const result = await apiRequest<{ token: string; user: AuthenticatedUser }>(
      '/auth/setup-admin',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: false }
    );

    if (!result.error && result.data) {
      emitAuth('SIGNED_IN', {
        access_token: result.data.token,
        user: { id: result.data.user.id, email: result.data.user.email },
      });
    }

    return result;
  },

  getApiBaseUrl() {
    return API_BASE_URL;
  },
};

export type { AuthSession, AuthUser, AuthenticatedUser };