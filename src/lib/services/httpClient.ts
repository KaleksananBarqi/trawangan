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
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Universal fetch wrapper
 */
export async function universalFetch(
  url: string,
  options?: UniversalFetchOptions
): Promise<UniversalResponse> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const timeoutSecs = Math.max(1, Math.ceil((options?.timeoutMs || 10000) / 1000));
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

  // Fallback ke global fetch (Node.js test environment atau browser biasa)
  const res = await globalThis.fetch(url, {
    headers: options?.headers,
    signal: options?.signal,
  });

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    text: () => res.text(),
    json: <T = any>() => res.json() as Promise<T>,
  };
}
