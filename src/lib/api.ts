// ============================================================================
// DocStroy API Client — замена @supabase/supabase-js
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'docstroy-token';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  display_name: string;
  structure: string;
  organization: string;
  position: string;
  phone: string | null;
  is_portal_admin: boolean;
  is_global_reader: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  user: User;
  access_token: string;
}

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type AuthCallback = (event: AuthEvent, session: Session | null) => void;

// ============================================================================
// Token management
// ============================================================================

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ============================================================================
// Auth event bus
// ============================================================================

const authListeners = new Set<AuthCallback>();

function emitAuthEvent(event: AuthEvent, session: Session | null): void {
  authListeners.forEach((cb) => {
    try { cb(event, session); } catch (e) { console.error('Auth listener error:', e); }
  });
}

// ============================================================================
// Core fetch with auto-refresh
// ============================================================================

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        emitAuthEvent('TOKEN_REFRESHED', { user: {} as User, access_token: data.access_token });
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T = unknown>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    isFormData?: boolean;
  } = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { body, params, isFormData } = options;

  let url = path.startsWith('http') ? path : `${API_URL}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) searchParams.set(key, String(val));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (body) {
    fetchOptions.body = isFormData ? (body as FormData) : JSON.stringify(body);
  }

  let res = await fetch(url, fetchOptions);

  // Auto-refresh on 401
  if (res.status === 401 && token) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...fetchOptions, headers });
    }

    if (res.status === 401) {
      clearToken();
      emitAuthEvent('SIGNED_OUT', null);
      return { data: null, error: 'Сессия истекла', status: 401 };
    }
  }

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errorMsg = errBody.error || errBody.message || errorMsg;
    } catch { /* no json body */ }
    return { data: null, error: errorMsg, status: res.status };
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const data = await res.json();
    return { data: data as T, error: null, status: res.status };
  }

  // Non-JSON response (blobs, etc.)
  return { data: null, error: null, status: res.status };
}

// ============================================================================
// api — замена supabase.from() и supabase.rpc()
// ============================================================================

export const api = {
  get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return request<T>('GET', path, { params });
  },

  post<T = unknown>(path: string, body?: unknown) {
    return request<T>('POST', path, { body });
  },

  patch<T = unknown>(path: string, body?: unknown) {
    return request<T>('PATCH', path, { body });
  },

  put<T = unknown>(path: string, body?: unknown) {
    return request<T>('PUT', path, { body });
  },

  delete<T = unknown>(path: string, body?: unknown) {
    return request<T>('DELETE', path, { body });
  },

  rpc<T = unknown>(functionName: string, params?: Record<string, unknown>) {
    return request<T>('POST', `/api/rpc/${functionName}`, { body: params });
  },

  upload<T = unknown>(path: string, formData: FormData) {
    return request<T>('POST', path, { body: formData, isFormData: true });
  },
};

// ============================================================================
// auth — замена supabase.auth
// ============================================================================

export const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const result = await request<{ access_token: string; user: User }>(
      'POST', '/api/auth/login', { body: { email, password } },
    );
    if (result.data?.access_token) {
      setToken(result.data.access_token);
      const session: Session = { user: result.data.user, access_token: result.data.access_token };
      emitAuthEvent('SIGNED_IN', session);
      return { data: { session, user: result.data.user }, error: null };
    }
    return { data: { session: null, user: null }, error: result.error };
  },

  async signInByName({ query, password }: { query: string; password: string }) {
    const result = await request<{ access_token: string; user: User }>(
      'POST', '/api/auth/login-by-name', { body: { query, password } },
    );
    if (result.data?.access_token) {
      setToken(result.data.access_token);
      const session: Session = { user: result.data.user, access_token: result.data.access_token };
      emitAuthEvent('SIGNED_IN', session);
      return { data: { session, user: result.data.user }, error: null };
    }
    return { data: { session: null, user: null }, error: result.error };
  },

  async signUp(userData: {
    email: string;
    password: string;
    last_name: string;
    first_name: string;
    middle_name?: string;
    structure: string;
    organization: string;
    position: string;
    phone?: string;
    project_id?: string;
  }) {
    const result = await request<{ user: { id: string; email: string } }>(
      'POST', '/api/auth/signup', { body: userData },
    );
    if (result.data) {
      return { data: { user: result.data.user }, error: null };
    }
    return { data: { user: null }, error: result.error };
  },

  async signOut() {
    await request('POST', '/api/auth/logout');
    clearToken();
    emitAuthEvent('SIGNED_OUT', null);
    return { error: null };
  },

  async getSession() {
    const token = getToken();
    if (!token) {
      return { data: { session: null }, error: null };
    }
    const result = await request<User>('GET', '/api/auth/me');
    if (result.data) {
      const session: Session = { user: result.data, access_token: token };
      return { data: { session }, error: null };
    }
    return { data: { session: null }, error: result.error };
  },

  async getUser() {
    const result = await request<User>('GET', '/api/auth/me');
    if (result.data) {
      return { data: { user: result.data }, error: null };
    }
    return { data: { user: null }, error: result.error };
  },

  onAuthStateChange(callback: AuthCallback) {
    authListeners.add(callback);

    // Check current session on subscribe
    const token = getToken();
    if (token) {
      request<User>('GET', '/api/auth/me').then((result) => {
        if (result.data) {
          callback('SIGNED_IN', { user: result.data, access_token: token });
        } else {
          clearToken();
          callback('SIGNED_OUT', null);
        }
      });
    }

    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          },
        },
      },
    };
  },

  async resetPasswordForEmail(email: string) {
    const result = await request('POST', '/api/auth/reset-password', { body: { email } });
    return { data: result.data, error: result.error };
  },
};

// ============================================================================
// storage — замена supabase.storage
// ============================================================================

export const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File | Blob, options?: { upsert?: boolean }) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucket);
        formData.append('path', path);
        if (options?.upsert) formData.append('upsert', 'true');
        return api.upload<{ storage_path: string }>('/api/files/upload', formData);
      },

      async download(path: string) {
        const token = getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${API_URL}/api/files/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
          { headers, credentials: 'include' },
        );

        if (!res.ok) {
          return { data: null, error: `HTTP ${res.status}` };
        }
        const blob = await res.blob();
        return { data: blob, error: null };
      },

      async remove(paths: string[]) {
        return api.post('/api/files/remove', { bucket, paths });
      },

      async createSignedUrl(path: string, expiresIn = 3600) {
        const result = await api.get<{ url: string }>('/api/files/signed-url', {
          bucket,
          path,
          expiresIn,
        });
        if (result.data) {
          return { data: { signedUrl: result.data.url }, error: null };
        }
        return { data: null, error: result.error };
      },
    };
  },
};

// ============================================================================
// Default export (drop-in for `import { supabase } from ...`)
// ============================================================================

const supabase = { auth, storage, api, rpc: api.rpc };
export default supabase;
