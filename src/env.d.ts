/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 构建 E2E 专用产物时设为 1，开启 window.__WTP_DEBUG__。 */
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
