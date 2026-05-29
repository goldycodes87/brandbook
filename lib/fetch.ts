export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { credentials: 'include', ...init })
}

export async function apiGet(url: string): Promise<Response> {
  return apiFetch(url)
}

export async function apiPost(url: string, body?: unknown): Promise<Response> {
  if (body instanceof FormData) {
    return apiFetch(url, { method: 'POST', body })
  }
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
}

export async function apiPatch(url: string, body?: unknown): Promise<Response> {
  return apiFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
}

export async function apiDelete(url: string): Promise<Response> {
  return apiFetch(url, { method: 'DELETE' })
}
