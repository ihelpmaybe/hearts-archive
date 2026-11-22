/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCHIVE_FACE?: string;
  readonly VITE_LAB_SEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "@trezor/connect-web" {
  const TrezorConnect: {
    init: (opts: Record<string, unknown>) => Promise<void>;
    ethereumGetAddress: (opts: Record<string, unknown>) => Promise<{
      success: boolean;
      payload?: unknown;
      error?: unknown;
    }>;
    ethereumSignTransaction: (opts: Record<string, unknown>) => Promise<{
      success: boolean;
      payload?: unknown;
      error?: unknown;
    }>;
    getFeatures: () => Promise<{
      success: boolean;
      payload?: unknown;
    }>;
  };
  export default TrezorConnect;
}
