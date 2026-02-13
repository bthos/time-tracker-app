/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Tauri types
interface Window {
  __TAURI__?: {
    window: {
      getCurrent: () => {
        show: () => Promise<void>;
      };
    };
  };
}
