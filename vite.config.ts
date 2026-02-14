import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";
import { pluginFrontendServer } from "./vite.plugin";

// Read version from package.json
const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Only enable plugin server in development mode
    ...(mode === 'development' ? [pluginFrontendServer()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
  },
  define: {
    // Make version available as import.meta.env.VITE_APP_VERSION
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // tell vite to ignore watching `backend`
      ignored: ["**/backend/**"],
    },
    // Disable warmup - it can cause blocking issues
    fs: {
      // Allow serving files from plugins directory
      allow: [".."],
    },
  },
  optimizeDeps: {
    // Pre-bundle dependencies for faster startup
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@tanstack/react-query',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    // Exclude large dependencies that don't need pre-bundling
    exclude: [],
    // Optimize entry points - this helps Vite discover dependencies early
    entries: ['./frontend/main.tsx'],
    // Use esbuild for faster pre-bundling
    esbuildOptions: {
      target: 'es2022',
    },
  },
}));
