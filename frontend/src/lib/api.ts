const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function api<T = any>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const authApi = {
  register: (data: { email?: string; phone?: string; password?: string; name?: string }) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email?: string; phone?: string; password: string }) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  refresh: (refreshToken: string) =>
    api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
};

export const orgApi = {
  list: (token: string) => api('/organizations', { token }),
  create: (token: string, data: { name: string; slug: string }) =>
    api('/organizations', { method: 'POST', token, body: JSON.stringify(data) }),
};

export const workbookApi = {
  list: (token: string, orgId: string) =>
    api(`/organizations/${orgId}/workbooks`, { token }),
  create: (token: string, orgId: string, data: { name: string; description?: string }) =>
    api(`/organizations/${orgId}/workbooks`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),
};

export const permissionApi = {
  grant: (
    token: string,
    data: {
      email?: string;
      phone?: string;
      name?: string;
      workbookIds?: string[];
      sheetIds?: string[];
      permission?: string;
      expiresAt?: string;
    },
  ) =>
    api('/permissions/grant', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),
};
