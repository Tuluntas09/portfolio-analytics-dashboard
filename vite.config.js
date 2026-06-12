import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 8502,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8502,
    strictPort: true,
  },
  esbuild: {
    // Classic JSX transform: all src/*.jsx files import React from the npm
    // package and use the @jsx pragma for explicit React.createElement calls.
    // public/legacy/*.jsx files are static assets served as-is by Vite and
    // are unaffected by this setting.
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  build: {
    // public/legacy/*.jsx are preserved reference files, not production assets.
    // Exclude them from dist/ so the build output contains only compiled code.
    // Dev mode (npm run dev) is unaffected — publicDir files are still served.
    copyPublicDir: false,
  },
});
