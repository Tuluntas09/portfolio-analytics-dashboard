import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 8502,
    strictPort: true,
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
});
