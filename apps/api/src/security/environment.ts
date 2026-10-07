export function environmentIdentity(mode: "baseline" | "secure") {
  return {
    sessionCookie: `bg_${mode}_session`,
    refreshCookie: `bg_${mode}_refresh`,
    csrfCookie: `bg_${mode}_csrf`,
    issuer: `bookguard-${mode}-api`,
    audience: `bookguard-${mode}-web`
  } as const;
}
