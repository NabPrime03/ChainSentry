/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SERVER_API_KEY?: string;
  readonly VITE_ETHERSCAN_API_KEY?: string;
  readonly VITE_BLOCKSTREAM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
