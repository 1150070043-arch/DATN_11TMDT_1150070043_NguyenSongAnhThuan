import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpSession, type SessionResponse } from "./http-session.js";

const baselineUrl = process.env.BASELINE_URL ?? "http://localhost:4001";
const secureUrl = process.env.SECURE_URL ?? "http://localhost:4002";

type RawObservation = {
  protected: boolean;
  status: number;
  evidence: string;
  requestId?: string | undefined;
};

type Observation = RawObservation & {
  durationMs: number;
};

type CaseResult = {
  id: string;
  name: string;
  reference: string;
  baseline: Observation;
  secure: Observation;
  passed: boolean;
};

type TestCase = {
  id: string;
  name: string;
  reference: string;
  run: (baseUrl: string, mode: "baseline" | "secure") => Promise<RawObservation>;
};

function bodyText(response: SessionResponse): string {
  return JSON.stringify(response.body);
}

function tamperToken(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) throw new Error("Unexpected JWT shape");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  payload.sub = "1";
  payload.role = "admin";
  parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return parts.join(".");
}

async function measure(testCase: TestCase, baseUrl: string, mode: "baseline" | "secure"): Promise<Observation> {
  const startedAt = performance.now();
  const observation = await testCase.run(baseUrl, mode);
  const expectedStatus: Record<string, [number, number]> = {
    TC01: [200, 200], TC02: [201, 201], TC03: [200, 403], TC04: [200, 401],
    TC05: [401, 429], TC06: [200, 403], TC07: [200, 403], TC08: [200, 200],
    TC09: [200, 200], TC10: [201, 422]
  };
  if (observation.status !== expectedStatus[testCase.id]![mode === "baseline" ? 0 : 1]) {
    throw new Error(`${testCase.id} ${mode}: unexpected HTTP ${observation.status}; refusing to count unrelated throttling or server errors as security evidence.`);
  }
  return {
    ...observation,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100
  };
}

const cases: TestCase[] = [
  {
    id: "TC01",
    name: "SQL Injection",
    reference: "OWASP WSTG-INPV-05",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      const payload = encodeURIComponent("' OR 1=1)--");
      const response = await session.request(`/api/books?q=${payload}&limit=40`);
      const count = Array.isArray((response.body as { data?: unknown }).data)
        ? ((response.body as { data: unknown[] }).data.length)
        : 0;
      return {
        protected: response.status !== 200 || count === 0,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `payload result count=${count}`
      };
    }
  },
  {
    id: "TC02",
    name: "Stored XSS",
    reference: "OWASP WSTG-INPV-02",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const payload = "Nội dung kiểm thử <img src=x onerror=alert('TC02')>";
      const created = await session.request("/api/books/1/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: 5, content: payload })
      });
      const page = await session.request("/api/books/nha-gia-kim");
      const reflected = bodyText(page).includes("onerror=");
      return {
        protected: created.status >= 400 || !reflected,
        status: created.status,
        requestId: created.headers.get("x-request-id") ?? undefined,
        evidence: reflected ? "dangerous HTML remained in response" : "dangerous HTML removed"
      };
    }
  },
  {
    id: "TC03",
    name: "Cross-Site Request Forgery",
    reference: "OWASP WSTG-SESS-05",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const response = await session.request(
        "/api/profile",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: "CSRF Test User",
            phone: "0900000000",
            addressLine: "Địa chỉ bị thay đổi bởi request giả mạo"
          })
        },
        { useCsrf: false, origin: "http://attacker.bookguard.local" }
      );
      return {
        protected: response.status === 403,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `state-changing request without CSRF token returned HTTP ${response.status}`
      };
    }
  },
  {
    id: "TC04",
    name: "Authentication Failure / tampered JWT",
    reference: "OWASP WSTG-SESS-10",
    run: async (baseUrl, mode) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const token = session.cookie(`bg_${mode}_session`);
      if (!token) throw new Error("Session cookie missing");
      session.setCookie(`bg_${mode}_session`, tamperToken(token));
      const response = await session.request("/api/admin/users");
      return {
        protected: response.status === 401 || response.status === 403,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `tampered token returned HTTP ${response.status}`
      };
    }
  },
  {
    id: "TC05",
    name: "Brute Force",
    reference: "OWASP WSTG-ATHN-03",
    run: async (baseUrl, mode) => {
      const session = new HttpSession(baseUrl);
      const targetEmail = `bruteforce-${Date.now()}-${mode}@bookguard.local`;
      let lastStatus = 0;
      let requestId: string | undefined;
      for (let attempt = 0; attempt < 7; attempt += 1) {
        const response = await session.request("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: targetEmail,
            password: `wrong-${attempt}`
          })
        });
        lastStatus = response.status;
        requestId = response.headers.get("x-request-id") ?? undefined;
      }
      return {
        protected: lastStatus === 429,
        status: lastStatus,
        requestId,
        evidence: `seventh failed login returned HTTP ${lastStatus}`
      };
    }
  },
  {
    id: "TC06",
    name: "Broken Access Control",
    reference: "OWASP WSTG-ATHZ-02",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const response = await session.request("/api/admin/users");
      return {
        protected: response.status === 403,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `customer access to admin API returned HTTP ${response.status}`
      };
    }
  },
  {
    id: "TC07",
    name: "IDOR",
    reference: "OWASP WSTG-ATHZ-04",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const response = await session.request("/api/orders/101");
      return {
        protected: response.status === 403,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `customer A reading customer B order returned HTTP ${response.status}`
      };
    }
  },
  {
    id: "TC08",
    name: "Security Misconfiguration",
    reference: "OWASP Top 10 A05:2021",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      const response = await session.request(
        "/api/health",
        {},
        { origin: "http://evil.example" }
      );
      const allowOrigin = response.headers.get("access-control-allow-origin");
      const poweredBy = response.headers.get("x-powered-by");
      const protectedResult = allowOrigin !== "http://evil.example" && !poweredBy;
      return {
        protected: protectedResult,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `allow-origin=${allowOrigin ?? "none"}, x-powered-by=${poweredBy ?? "none"}`
      };
    }
  },
  {
    id: "TC09",
    name: "Sensitive Data Exposure",
    reference: "OWASP Top 10 A02:2021",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const response = await session.request("/api/auth/me");
      const exposed = /PasswordSecret|passwordSecret/i.test(bodyText(response));
      return {
        protected: !exposed,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: exposed ? "credential field exposed" : "response DTO contains no credential field"
      };
    }
  },
  {
    id: "TC10",
    name: "Unsafe File Upload",
    reference: "OWASP WSTG-BUSL-08",
    run: async (baseUrl) => {
      const session = new HttpSession(baseUrl);
      await session.login();
      const form = new FormData();
      form.append("avatar", new Blob(["MZ harmless thesis marker"], { type: "application/x-msdownload" }), "marker.exe");
      const response = await session.request("/api/profile/avatar", {
        method: "POST",
        body: form
      });
      return {
        protected: response.status === 422,
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
        evidence: `disallowed executable upload returned HTTP ${response.status}`
      };
    }
  }
];

async function assertHealthy(baseUrl: string, expectedMode: string): Promise<void> {
  const response = await new HttpSession(baseUrl).request("/api/health");
  if (response.status !== 200 || !bodyText(response).includes(expectedMode)) {
    throw new Error(`${expectedMode} API is not healthy at ${baseUrl}`);
  }
  if ((response.body as { data?: { auditFixture?: boolean } })?.data?.auditFixture !== true) {
    throw new Error("Refusing to run attack fixtures against a regular database. Use docker-compose.audit.yml.");
  }
}

async function main(): Promise<void> {
  await Promise.all([
    assertHealthy(baselineUrl, "baseline"),
    assertHealthy(secureUrl, "secure")
  ]);

  const results: CaseResult[] = [];
  // Brute-force runs last because its intended lockout would otherwise block
  // later authenticated scenarios from the same test-runner IP address.
  const executionOrder = [
    ...cases.filter((testCase) => testCase.id !== "TC05"),
    ...cases.filter((testCase) => testCase.id === "TC05")
  ];
  for (const testCase of executionOrder) {
    const [baseline, secure] = await Promise.all([
      measure(testCase, baselineUrl, "baseline"),
      measure(testCase, secureUrl, "secure")
    ]);
    results.push({
      id: testCase.id,
      name: testCase.name,
      reference: testCase.reference,
      baseline,
      secure,
      passed: !baseline.protected && secure.protected
    });
  }
  results.sort((left, right) => left.id.localeCompare(right.id));

  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    baselineVulnerable: results.filter((item) => !item.baseline.protected).length,
    secureProtected: results.filter((item) => item.secure.protected).length
  };
  const outputDir = path.resolve(process.cwd(), "../../reports/generated");
  await mkdir(outputDir, { recursive: true });
  const timestamp = generatedAt.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const jsonReport = JSON.stringify({ summary, results }, null, 2);
  await writeFile(
    path.join(outputDir, "security-results.json"),
    jsonReport
  );
  await writeFile(path.join(outputDir, `security-results-${timestamp}.json`), jsonReport);

  const rows = results.map(
    (item) =>
      `| ${item.id} | ${item.name} | ${item.reference} | ${item.baseline.protected ? "Bị chặn" : "Khai thác được"} (${item.baseline.durationMs} ms) | ${item.secure.protected ? "Bị chặn" : "Khai thác được"} (${item.secure.durationMs} ms) | ${item.passed ? "Đạt" : "Chưa đạt"} |`
  );
  const markdown = [
    "# Kết quả kiểm thử bảo mật BookGuard",
    "",
    `Thời điểm: ${generatedAt}`,
    "",
    `Kết quả đạt: **${summary.passed}/${summary.total}**`,
    "",
    "| Mã | Kịch bản | Tham chiếu | Baseline | Secure | So sánh |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Bằng chứng",
    "",
    ...results.flatMap((item) => [
      `### ${item.id} — ${item.name}`,
      "",
      `- Tham chiếu: ${item.reference}`,
      `- Baseline: HTTP ${item.baseline.status}; ${item.baseline.durationMs} ms; ${item.baseline.evidence}`,
      `- Secure: HTTP ${item.secure.status}; ${item.secure.durationMs} ms; ${item.secure.evidence}`,
      ""
    ])
  ].join("\n");
  await writeFile(path.join(outputDir, "security-results.md"), markdown);

  console.table(
    results.map((item) => ({
      case: item.id,
      baseline: item.baseline.protected ? "blocked" : "vulnerable",
      secure: item.secure.protected ? "blocked" : "vulnerable",
      comparison: item.passed ? "PASS" : "FAIL"
    }))
  );
  if (summary.passed !== summary.total) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
