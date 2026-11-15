/**
 * Small fetch wrapper shared by every built-in adapter.
 *
 * Remote services answer with JSON but occasionally with an HTML error page,
 * so failures are normalized into `HttpError` with a readable message instead
 * of leaking parser errors into the UI.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly detail?: string;

  constructor(message: string, status: number, url: string, detail?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.detail = detail;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  /** Query parameters; undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions['query'],
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${suffix}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function describeStatus(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return 'Rejected - check the API key';
    case 404:
      return 'Not found - check the URL or base path';
    case 429:
      return 'Rate limited by the server';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server error';
    default:
      return `Request failed (${status})`;
  }
}

export async function request(
  url: string,
  options: RequestOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail: string | undefined;
      try {
        const text = await response.text();
        detail = text.slice(0, 400).trim() || undefined;
      } catch {
        detail = undefined;
      }
      throw new HttpError(
        describeStatus(response.status),
        response.status,
        url,
        detail,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HttpError('Timed out', 0, url);
    }
    if (error instanceof TypeError) {
      // Unreachable host, TLS rejection, DNS failure or a blocked CORS preflight.
      throw new HttpError(
        'Cannot reach the server. Check the address, the port and that this device is on the same network.',
        0,
        url,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await request(url, options);
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(
      'Unexpected response - the address may point at a web page instead of the API',
      response.status,
      url,
      text.slice(0, 200),
    );
  }
}

/** JSON-RPC helper used by NZBGet. */
export async function requestRpc<T>(
  url: string,
  method: string,
  params: unknown[],
  headers: Record<string, string>,
  timeoutMs?: number,
): Promise<T> {
  const payload = { version: '1.1', method, params };
  const result = await requestJson<
    { result?: T; error?: { message?: string } } | T
  >(url, { method: 'POST', headers, body: payload, timeoutMs });
  if (result && typeof result === 'object' && 'error' in result) {
    const error = (result as { error?: { message?: string } }).error;
    throw new HttpError(error?.message ?? 'NZBGet rejected the call', 0, url);
  }
  if (result && typeof result === 'object' && 'result' in result) {
    return (result as { result: T }).result;
  }
  return result as T;
}
