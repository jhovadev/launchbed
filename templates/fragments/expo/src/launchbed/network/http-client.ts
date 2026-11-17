/**
 * Provider-neutral HTTP client on the platform fetch: base URL, timeout and typed results.
 * No base URL, API key or backend is bundled. Keep secrets on your server, not in the app.
 */
export type ApiResult<T> =
  | { kind: "success"; value: T; status: number }
  | { kind: "http-error"; status: number; body: string }
  | { kind: "network-error"; message: string }
  | { kind: "timeout" };

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface HttpClient {
  getText(path: string): Promise<ApiResult<string>>;
  getJson<T = unknown>(path: string): Promise<ApiResult<T>>;
  postJson<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const base = options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`;

  async function request(path: string, init: RequestInit): Promise<ApiResult<string>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(new URL(path.replace(/^\//, ""), base).toString(), {
        ...init,
        headers: { Accept: "application/json", ...options.headers, ...(init.headers as Record<string, string> | undefined) },
        signal: controller.signal,
      });
      const body = await response.text();
      return response.ok ? { kind: "success", value: body, status: response.status } : { kind: "http-error", status: response.status, body };
    } catch (error) {
      if (controller.signal.aborted) return { kind: "timeout" };
      return { kind: "network-error", message: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  function parse<T>(result: ApiResult<string>): ApiResult<T> {
    if (result.kind !== "success") return result;
    try {
      return { kind: "success", value: (result.value ? JSON.parse(result.value) : null) as T, status: result.status };
    } catch {
      return { kind: "network-error", message: "The response was not valid JSON" };
    }
  }

  return {
    getText: (path) => request(path, { method: "GET" }),
    getJson: async (path) => parse(await request(path, { method: "GET" })),
    postJson: async (path, body) =>
      parse(await request(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })),
  };
}
