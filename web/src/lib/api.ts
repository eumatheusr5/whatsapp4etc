import { supabase } from './supabase';

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiError {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
}

class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: ApiError) {
    super(body.message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  isFormData = false,
): Promise<T> {
  const auth = await authHeader();
  const headers: Record<string, string> = { ...auth };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = (body as { code?: string; message?: string; detail?: Record<string, unknown> }) || {};
    throw new HttpError(res.status, {
      code: err.code ?? `HTTP_${res.status}`,
      message: err.message ?? `Erro ${res.status}`,
      detail: err.detail,
    });
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }, true),
};

export { HttpError, API_URL };
