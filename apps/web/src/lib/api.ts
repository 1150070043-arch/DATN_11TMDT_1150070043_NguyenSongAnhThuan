const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4002";
let csrfToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

const NO_AUTO_REFRESH = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/refresh"
]);

type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "API_ERROR",
    public readonly requestId?: string,
    public readonly details: Array<{ field?: string; message?: string }> = []
  ) {
    super(message);
  }
}

export function setCsrfToken(value: string | null | undefined): void {
  csrfToken = value ?? null;
}

function cookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function currentCsrfToken(): string | null {
  const mode = import.meta.env.VITE_SECURITY_MODE === "baseline" ? "baseline" : "secure";
  return csrfToken ?? cookie(`bg_${mode}_csrf`);
}

function requestHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && !(options.body instanceof FormData);
  if (hasBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const method = (options.method ?? "GET").toUpperCase();
  const token = currentCsrfToken();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && token) {
    headers.set("x-csrf-token", token);
  }
  return headers;
}

async function fetchApi(path: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers: requestHeaders(options),
      credentials: "include",
      signal: options.signal ?? AbortSignal.timeout(15_000)
    });
  } catch (cause) {
    if (cause instanceof DOMException && ["AbortError", "TimeoutError"].includes(cause.name)) {
      throw new ApiError("Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.", 0, "REQUEST_TIMEOUT");
    }
    throw new ApiError("Không thể kết nối tới máy chủ. Hãy kiểm tra kết nối và thử lại.", 0, "NETWORK_ERROR");
  }
}

async function refreshSession(): Promise<boolean> {
  if (import.meta.env.VITE_SECURITY_MODE === "baseline") return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetchApi("/api/auth/refresh", { method: "POST" }).catch(() => null);
      if (!response?.ok) return false;
      const body = (await response.json().catch(() => ({}))) as ApiEnvelope<{
        csrfToken?: string | null;
      }>;
      setCsrfToken(body.data?.csrfToken);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function fetchWithSession(path: string, options: RequestInit): Promise<Response> {
  let response = await fetchApi(path, options);
  if (response.status === 401 && !NO_AUTO_REFRESH.has(path) && await refreshSession()) {
    response = await fetchApi(path, options);
  }
  return response;
}

export function assetUrl(path?: string | null): string {
  if (!path) return "";
  return path.startsWith("/") ? `${API_URL}${path}` : path;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const response = await fetchWithSession(path, options);

  if (response.status === 204) return { data: undefined as T };
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      body.error?.message ?? "Không thể kết nối tới hệ thống.",
      response.status,
      body.error?.code,
      body.error?.requestId,
      body.error?.details ?? []
    );
  }
  return body;
}

export async function ensureCsrf(): Promise<void> {
  const result = await api<{ csrfToken: string | null }>("/api/auth/csrf");
  setCsrfToken(result.data.csrfToken);
}

export async function downloadApiFile(path: string, filename: string): Promise<void> {
  const response = await fetchWithSession(path, {});
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(
      body.error?.message ?? "Không thể tải tệp.",
      response.status,
      body.error?.code,
      body.error?.requestId,
      body.error?.details ?? []
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
