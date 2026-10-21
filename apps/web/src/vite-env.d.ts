/// <reference types="vite/client" />

declare module "virtual:bookguard-cover-manifest" {
  const covers: Record<string, Array<{ url: string; width: number; height: number }>>;
  export default covers;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SECURITY_MODE?: "baseline" | "secure";
  readonly VITE_MAIL_UI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
