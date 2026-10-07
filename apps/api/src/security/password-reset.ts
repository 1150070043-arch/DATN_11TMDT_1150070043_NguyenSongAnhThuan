import crypto from "node:crypto";

const TOKEN_BYTES = 32;

export type PasswordResetToken = {
  token: string;
  hash: string;
};

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPasswordResetToken(): PasswordResetToken {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashPasswordResetToken(token) };
}
