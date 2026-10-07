import type { AuthUser } from "../security/auth.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      requestId: string;
    }
  }
}

export {};
