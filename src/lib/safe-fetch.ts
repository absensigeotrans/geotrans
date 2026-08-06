/**
 * Safe fetch helper that handles JSON responses gracefully and catches HTML/500/404 errors
 * to prevent 'Unexpected token < in JSON' crashes.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data.error || data.message || `Server error (${res.status})`,
        };
      }
      return { ok: true, status: res.status, data };
    } else {
      const htmlText = await res.text();
      console.error(`[safeFetchJson] Expected JSON from ${url}, but received non-JSON (${contentType || 'unknown'}). Status: ${res.status}. Preview:`, htmlText.slice(0, 200));
      return {
        ok: false,
        status: res.status,
        error: `Server mengembalikan respon HTML/Non-JSON (Status ${res.status}). Harap periksa server atau log API.`,
      };
    }
  } catch (err: any) {
    console.error(`[safeFetchJson] Network error fetching ${url}:`, err);
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Gagal terhubung ke server',
    };
  }
}
