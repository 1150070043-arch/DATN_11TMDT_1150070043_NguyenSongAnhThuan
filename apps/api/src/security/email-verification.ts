import crypto from "node:crypto";

export function createEmailVerificationToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashEmailVerificationToken(token) };
}

export function hashEmailVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
