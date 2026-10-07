import crypto from "node:crypto";

const TOKEN_BYTES = 48;

export type RefreshCredential = {
  token: string;
  hash: string;
};

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function createRefreshCredential(): RefreshCredential {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

