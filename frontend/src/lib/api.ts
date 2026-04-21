const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  url: string;

  constructor(status: number, url: string, message?: string) {
    super(message ?? `API ${status}: ${url}`);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

export async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, path, `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s: ${path}`);
    }
    throw new ApiError(0, path, `Network error: ${path}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new ApiError(res.status, path);
  }

  try {
    return await res.json() as T;
  } catch {
    throw new ApiError(res.status, path, `Invalid JSON response from ${path}`);
  }
}
