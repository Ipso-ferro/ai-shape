const BASE_URL = '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'include',
        ...options,
    });

    const json = await res.json();

    if (!res.ok) {
        if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
            const details = json.errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join(' | ');
            throw new Error(`${json.message} — ${details}`);
        }
        throw new Error(json.message || 'Request failed');
    }

    return json.data as T;
}

export const api = {
    post: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    get: <T>(path: string) =>
        request<T>(path, { method: 'GET' }),
    patch: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
