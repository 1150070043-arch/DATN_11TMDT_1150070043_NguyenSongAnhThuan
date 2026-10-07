/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SECURITY_MODE?: "baseline" | "secure";
  readonly VITE_MAIL_UI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
