import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  server: {
    port: 3000,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  resolve: {
    extensions: [".mjs", ".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      pino: "pino/browser.js",
    },
  },
  define: {
    // Required for @stellar/stellar-sdk and @stellar/freighter-api
    "process.env": "{}",
    global: "globalThis",
  },
  optimizeDeps: {
    // Only pre-bundle the lightweight, always-loaded deps. The heavy ZK
    // stack (bb.js + noir_js) is excluded so it can be loaded lazily at
    // runtime — the browser only fetches it when the user actually clicks
    // "Generate Proof" (which is the only place we import it).
    //
    // We also exclude the wallet kit because it ships its own dynamic
    // imports for each module (freighter, lobstr, xbull, etc.). Pre-bundling
    // them with esbuild can sometimes trip on the dynamic require() calls
    // used by the older wallet extensions.
    // The wallet kit's modules (Lobstr, Albedo, xBull, etc.) import from
    // CJS/UMD packages using ESM named imports. Those CJS packages must be
    // pre-bundled so esbuild converts their exports to named ESM form;
    // otherwise Vite serves them raw and the named import fails.
    //
    // The wallet kit itself stays excluded (its dynamic module loading trips
    // esbuild) but the underlying CJS deps that its individual modules import
    // are included so esbuild converts them before serving.
    include: [
      "@stellar/stellar-sdk",
      "@stellar/freighter-api",
      "@lobstrco/signer-extension-api",
      "@albedo-link/intent",
      "@creit.tech/xbull-wallet-connect",
    ],
    exclude: [
      "@aztec/bb.js",
      "@noir-lang/noir_js",
      "@creit.tech/stellar-wallets-kit/sdk",
      "@creit.tech/stellar-wallets-kit/modules/utils",
    ],
  },
  worker: {
    format: "es",
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
