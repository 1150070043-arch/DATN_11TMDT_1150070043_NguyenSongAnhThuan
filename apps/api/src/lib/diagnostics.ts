// Request query strings can contain password-reset tokens, email addresses and
// payment signatures. Diagnostics need the endpoint, never those values.
export function diagnosticPath(originalUrl: string): string {
  return originalUrl.split(/[?#]/, 1)[0]!.replace(/[\r\n\x00-\x1f\x7f]/g, "").slice(0, 500);
}

export function diagnosticErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
    ? code : "INTERNAL_ERROR";
}
