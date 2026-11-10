// Universal HTTP Client Bridge untuk Trawangan Desktop & Web
// Menyediakan pemanggilan HTTP yang kebal terhadap aturan CORS browser ketika berjalan di desktop Tauri (via Native Rust IPC),
// dan tetap kompatibel penuh dengan global fetch ketika berjalan di web browser maupun lingkungan testing Node.js.

export interface UniversalResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json<T = any>(): Promise<T>;
}

export interface UniversalFetchOptions {
  method?: 'GET' | 'POST';
  body?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const DEFAULT_HTTP_TIMEOUT_MS = 10000;

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Membangun error timeout dengan nama AbortError agar konsisten dengan perilaku standar fetch signal
 */
function createTimeoutError(timeoutMs: number): Error {
  const err = new Error(`Request timeout setelah ${timeoutMs}ms`);
  err.name = 'AbortError';
  return err;
}

/**
 * Universal fetch wrapper (mendukung GET & POST serta perlindungan timeoutMs lintas desktop Tauri dan Web)
 */
export async function universalFetch(
  url: string,
  options?: UniversalFetchOptions
): Promise<UniversalResponse> {
  const method = (options?.method || 'GET').toUpperCase() as 'GET' | 'POST';

  // Jalur Tauri native IPC hanya mengekspos http_get; permintaan POST (mis. Hyperliquid /info) memakai fetch ber-timeout
  if (isTauriEnvironment() && method === 'GET') {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const timeoutSecs = Math.max(1, Math.ceil((options?.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS) / 1000));
      const bodyText = await invoke<string>('http_get', { url, timeoutSecs });

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => bodyText,
        json: async <T = any>() => JSON.parse(bodyText) as T,
      };
    } catch (err: any) {
      const errMsg = typeof err === 'string' ? err : err?.message || String(err);

      // Ekstraksi kode status HTTP jika ada (misal: "Server mengembalikan status HTTP 404: Not Found")
      const statusMatch = errMsg.match(/status HTTP (\d+)/i);
      if (statusMatch) {
        const statusCode = parseInt(statusMatch[1], 10);
        return {
          ok: false,
          status: statusCode,
          statusText: errMsg,
          text: async () => errMsg,
          json: async () => {
            throw new Error(errMsg);
          },
        };
      }

      // Jika murni network error / timeout, lempar exception seperti fetch bawaan
      throw new Error(`[universalFetch:Tauri] ${errMsg}`);
    }
  }

  // Fallback ke global fetch (Node.js test environment, browser biasa, atau permintaan non-GET pada Tauri)
  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const timeoutMs = options?.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const externalSignal = options?.signal;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let onExternalAbort: (() => void) | null = null;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort((externalSignal as any).reason);
    } else {
      onExternalAbort = () => controller.abort((externalSignal as any).reason);
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const mergedHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...(options?.headers || {}),
  };
  const hasContentType = Object.keys(mergedHeaders).some((k) => k.toLowerCase() === 'content-type');
  if (method === 'POST' && options?.body !== undefined && !hasContentType) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  const fetchInit: RequestInit = {
    method,
    headers: mergedHeaders,
    signal: controller.signal,
  };
  if (method !== 'GET' && options?.body !== undefined) {
    fetchInit.body = options.body;
  }

  const fetchPromise = globalThis.fetch(url, fetchInit);

  // Pasang pengaman timeout nyata bahkan jika implementasi fetch tidak langsung menghormati AbortSignal
  // Timer dibiarkan ref selama await aktif agar event loop tidak berhenti sebelum timeout terpicu (dibersihkan di finally)
  const timeoutPromise =
    timeoutMs > 0
      ? new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            const timeoutErr = createTimeoutError(timeoutMs);
            controller.abort(timeoutErr);
            reject(timeoutErr);
          }, timeoutMs);
        })
      : null;

  // Cegah unhandled rejection jika timeoutPromise memenangkan race sebelum fetch reject
  if (timeoutPromise) {
    fetchPromise.catch(() => {});
  }

  try {
    const res = timeoutPromise ? await Promise.race([fetchPromise, timeoutPromise]) : await fetchPromise;

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      text: () => res.text(),
      json: <T = any>() => res.json() as Promise<T>,
    };
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
