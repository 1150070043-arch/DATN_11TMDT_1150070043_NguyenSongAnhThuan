function invalid(code: string, message: string): Error { return Object.assign(new Error(message), { code }); }
export function provisioningPolicy(reset: boolean, target: "baseline" | "secure" | "all", env = process.env) {
  const production = env.DB_PROVISION_MODE === "production" || (env.NODE_ENV === "production" && env.ALLOW_INSECURE_LAB !== "true");
  if (env.DB_PROVISION_MODE && !["production", "lab"].includes(env.DB_PROVISION_MODE)) throw invalid("INVALID_PROVISION_MODE", "DB_PROVISION_MODE must be lab or production.");
  if (production && (reset || target !== "secure")) throw invalid("PRODUCTION_PROVISIONING_FORBIDDEN", "Production provisioning only permits init secure; reset and demo seed are disabled.");
  return { production, seedDemo: !production };
}

export function initialAdminCredentials(env = process.env) {
  const email = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw invalid("INVALID_INITIAL_ADMIN_EMAIL", "Set a valid INITIAL_ADMIN_EMAIL.");
  if (!password || password.length < 16 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
    throw invalid("INVALID_INITIAL_ADMIN_PASSWORD", "INITIAL_ADMIN_PASSWORD must be 16–128 characters with upper/lowercase, a number and a symbol.");
  }
  return { email, password };
}
