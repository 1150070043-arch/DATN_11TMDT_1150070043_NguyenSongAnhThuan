type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type SessionResponse = {
  status: number;
  headers: Headers;
  body: JsonValue;
};

export class HttpSession {
  private readonly cookies = new Map<string, string>();
  private csrfToken: string | null = null;

  constructor(public readonly baseUrl: string) {}

  private updateCookies(headers: Headers): void {
    const values = headers.getSetCookie();
    for (const value of values) {
      const pair = value.split(";", 1)[0];
      if (!pair) continue;
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator);
      const cookieValue = pair.slice(separator + 1);
      if (cookieValue) this.cookies.set(name, cookieValue);
      else this.cookies.delete(name);
    }
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  async request(
    path: string,
    init: RequestInit = {},
    options: { useCsrf?: boolean; origin?: string } = {}
  ): Promise<SessionResponse> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        Array.from(this.cookies, ([name, value]) => `${name}=${value}`).join("; ")
      );
    }
    if (options.origin) headers.set("origin", options.origin);
    const method = (init.method ?? "GET").toUpperCase();
    if (
      options.useCsrf !== false &&
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      this.csrfToken
    ) {
      headers.set("x-csrf-token", this.csrfToken);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(15_000)
    });
    this.updateCookies(response.headers);
    const body = (await response.json().catch(() => null)) as JsonValue;
    const envelope = body as { data?: { csrfToken?: unknown } } | null;
    const token = envelope?.data?.csrfToken;
    if (typeof token === "string") this.csrfToken = token;
    return { status: response.status, headers: response.headers, body };
  }

  async login(email = "customer.a@bookguard.local", password = "Customer@123"): Promise<void> {
    const response = await this.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (response.status !== 200) {
      throw new Error(`Login failed for ${this.baseUrl}: HTTP ${response.status}`);
    }
  }
}
