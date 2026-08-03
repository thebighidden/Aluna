'use client';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '/api';

export type StudioUser = {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'USER';
  permissions: string[];
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: StudioUser;
};

const sessionKey = 'aluna-auth-session';

function readStoredSession(): { session: AuthSession; remember: boolean } | undefined {
  for (const [storage, remember] of [
    [window.localStorage, true],
    [window.sessionStorage, false],
  ] as const) {
    const value = storage.getItem(sessionKey);
    if (!value) continue;
    try {
      return { session: JSON.parse(value) as AuthSession, remember };
    } catch {
      storage.removeItem(sessionKey);
    }
  }
  return undefined;
}

function saveSession(session: AuthSession, remember: boolean): void {
  window.localStorage.removeItem(sessionKey);
  window.sessionStorage.removeItem(sessionKey);
  (remember ? window.localStorage : window.sessionStorage).setItem(
    sessionKey,
    JSON.stringify(session),
  );
}

export function clearSession(): void {
  window.localStorage.removeItem(sessionKey);
  window.sessionStorage.removeItem(sessionKey);
}

export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<StudioUser> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await apiErrorMessage(response));
  const session = (await response.json()) as AuthSession;
  saveSession(session, remember);
  return session.user;
}

export async function logout(): Promise<void> {
  const stored = readStoredSession();
  if (stored) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.session.refreshToken }),
    }).catch(() => undefined);
  }
  clearSession();
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const stored = readStoredSession();
  if (!stored) throw new Error('Your Studio session has expired. Please sign in again.');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${stored.session.accessToken}`,
    },
  });
  if (response.status !== 401) return response;

  const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.session.refreshToken }),
  });
  if (!refreshed.ok) {
    clearSession();
    throw new Error('Your Studio session has expired. Please sign in again.');
  }
  const nextSession = (await refreshed.json()) as AuthSession;
  saveSession(nextSession, stored.remember);
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${nextSession.accessToken}`,
    },
  });
}

export async function currentUser(): Promise<StudioUser> {
  const response = await authFetch('/auth/me');
  if (!response.ok) throw new Error(await apiErrorMessage(response));
  return (await response.json()) as StudioUser;
}

export async function apiErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(' ');
    return payload.message ?? payload.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}
