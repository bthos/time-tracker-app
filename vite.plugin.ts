import { type Plugin } from "vite";
import path from "path";
import { readFileSync, existsSync } from "fs";
import os from "os";

// Get plugins directory path (same logic as backend)
function getPluginsDir(): string {
  const dataDir = process.platform === "win32" 
    ? path.join(os.homedir(), "AppData", "Roaming", "timetracker")
    : process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "timetracker")
    : path.join(os.homedir(), ".local", "share", "timetracker");
  return path.join(dataDir, "plugins");
}

// Normalize import path for lookup (strip extensions, use forward slashes)
function normalizeImportPath(importPath: string): string {
  let normalized = importPath.replace(/\\/g, "/");
  normalized = normalized.replace(/\.(ts|tsx|js|jsx)$/, "");
  return normalized;
}

// External modules provided by the app (part of plugin host API architecture)
const COMMON_COMPONENTS = [
  "Button", "Card", "ErrorBoundary", "Toggle", "CustomToast",
  "SkeletonLoader", "LoadingSpinner",
] as const;

function getExternalModuleRealPath(importPath: string): string | null {
  const normalized = normalizeImportPath(importPath);
  const root = path.resolve(__dirname, "frontend");

  const storePaths = ["./store", "../store", "store"];
  if (storePaths.some((p) => normalized === p || normalized.endsWith("/store"))) {
    const p = path.join(root, "store", "index.ts");
    return existsSync(p) ? p : null;
  }

  if (normalized.endsWith("/utils/format") || normalized === "utils/format") {
    const p = path.join(root, "utils", "format.ts");
    return existsSync(p) ? p : null;
  }
  if (normalized.endsWith("/utils/toast") || normalized === "utils/toast") {
    const p = path.join(root, "utils", "toast.ts");
    return existsSync(p) ? p : null;
  }

  for (const name of COMMON_COMPONENTS) {
    const variants = [
      `./components/Common/${name}`,
      `../components/Common/${name}`,
      `./Common/${name}`,
      `../Common/${name}`,
      `components/Common/${name}`,
      `Common/${name}`,
    ];
    if (variants.some((v) => normalized === v)) {
      const p = path.join(root, "components", "Common", `${name}.tsx`);
      return existsSync(p) ? p : null;
    }
  }

  return null;
}

// Custom plugin to serve plugin frontend files
export function pluginFrontendServer(): Plugin {
  // Map of virtual module IDs to real file paths
  const virtualModules = new Map<string, string>();
  
  return {
    name: "plugin-frontend-server",
    enforce: "pre", // Run before other plugins
    resolveId(id, importer) {
      // Handle virtual module IDs for plugin files
      if (id.startsWith("virtual:plugin:")) {
        return id; // Return the virtual ID to signal we handle it
      }
      
      // Handle imports from virtual plugin modules
      if (importer && importer.startsWith("virtual:plugin:")) {
        const realPath = virtualModules.get(importer);
        if (realPath) {
          // Only handle relative imports (starting with . or ..)
          // Bare imports (like "react", "lucide-react") should be handled by Vite's normal resolution
          if (id.startsWith(".") || id.startsWith("..")) {
            // External modules provided by the app (store, utils/format, utils/toast, components/Common/*)
            const appModulePath = getExternalModuleRealPath(id);
            if (appModulePath) {
              const ext = path.extname(appModulePath);
              const virtualId = `virtual:plugin:app:${normalizeImportPath(id)}${ext}`;
              virtualModules.set(virtualId, appModulePath);
              return virtualId;
            }
            // Resolve relative import relative to the plugin file path
            const resolvedPath = path.resolve(path.dirname(realPath), id);
            if (existsSync(resolvedPath)) {
              const pluginsDir = getPluginsDir();
              const relativePath = path.relative(pluginsDir, resolvedPath);
              const virtualId = `virtual:plugin:/plugins/${relativePath.replace(/\\/g, "/")}`;
              virtualModules.set(virtualId, resolvedPath);
              return virtualId;
            }
            // Unknown relative import: create a stub so plugins don't break at load time
            const stubModuleId = `virtual:plugin:stub:${id}`;
            virtualModules.set(stubModuleId, id);
            return stubModuleId;
          }
          // For bare imports, return null to let Vite handle them normally
        }
      }
      
      // Also handle /plugins/* paths as virtual modules
      if (id.startsWith("/plugins/")) {
        const cleanPath = id.split("?")[0];
        const match = cleanPath.match(/^\/plugins\/([^/]+)\/([^/]+)\/frontend\/(.+)$/);
        if (match) {
          const virtualId = `virtual:plugin:${cleanPath}`;
          const pluginsDir = getPluginsDir();
          const pluginPath = path.join(pluginsDir, match[1], match[2], "frontend", match[3]);
          if (existsSync(pluginPath)) {
            virtualModules.set(virtualId, pluginPath);
            return virtualId;
          }
        }
      }
      return null;
    },
    load(id) {
      if (id.startsWith("virtual:plugin:")) {
        // virtual:plugin:app:* are real app modules (store, utils/format, utils/toast, components/Common/*)
        const realPath = virtualModules.get(id);
        if (realPath && existsSync(realPath)) {
          return readFileSync(realPath, "utf-8");
        }
        // Stub only for unknown relative imports (not provided by app API)
        if (id.startsWith("virtual:plugin:stub:")) {
          const importPath = virtualModules.get(id);
          if (importPath) {
            const pathParts = importPath.split("/");
            const fileName = pathParts[pathParts.length - 1];
            const baseName = fileName.replace(/\.(js|ts|jsx|tsx)$/, "");
            const exports: string[] = [];
            if (importPath.includes("/hooks/")) {
              const hookName = baseName.startsWith("use") ? baseName : `use${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`;
              exports.push(`export const ${hookName} = () => ({ data: [], isLoading: false, error: null });`);
            } else if (importPath.includes("/services/")) {
              exports.push(`export const api = {};`);
              exports.push(`export default {};`);
            } else if (baseName.startsWith("use")) {
              exports.push(`export const ${baseName} = () => ({ data: [], isLoading: false, error: null });`);
            } else {
              exports.push(`export const ${baseName} = {};`);
              exports.push(`export default {};`);
            }
            return exports.length > 0 ? exports.join("\n") : "export {};";
          }
        }
      }
      return null;
    },
    configureServer(server) {
      // Use a more specific middleware that runs early
      interface ViteRequest {
        url?: string;
      }
      interface ViteResponse {
        writeHead: (code: number, headers: Record<string, string>) => void;
        end: (data: string) => void;
      }
      type ViteNext = () => void;
      const pluginMiddleware = async (req: ViteRequest, res: ViteResponse, next: ViteNext) => {
        const urlPath = req.url || "";
        
        // Only handle /plugins/* paths
        if (!urlPath.startsWith("/plugins/")) {
          next();
          return;
        }
        
        // Remove query string if present (e.g., ?import)
        const cleanPath = urlPath.split("?")[0];
        const match = cleanPath.match(/^\/plugins\/([^/]+)\/([^/]+)\/frontend\/(.+)$/);
        
        if (!match) {
          next();
          return;
        }
        
        const [, author, pluginId, filePath] = match;
        const pluginsDir = getPluginsDir();
        const pluginPath = path.join(pluginsDir, author, pluginId, "frontend", filePath);
        
        // Check if file exists
        if (!existsSync(pluginPath)) {
          console.error(`[Plugin Server] File not found: ${pluginPath}`);
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end(`Plugin file not found: ${pluginPath}\nPlugins dir: ${pluginsDir}\nAuthor: ${author}\nPlugin ID: ${pluginId}\nFile path: ${filePath}`);
          return;
        }
        
        // Read and serve the file
        // For JS/TS files, we need to process them through Vite to resolve bare imports
        const ext = path.extname(filePath);
        const isJavaScript = ext === ".js" || ext === ".ts" || ext === ".jsx" || ext === ".tsx";
        
        if (isJavaScript) {
          // Use virtual module approach - Vite will process it through transform pipeline
          const virtualId = `virtual:plugin:${cleanPath}`;
          virtualModules.set(virtualId, pluginPath);
          
          try {
            // Use Vite's transformRequest to process the virtual module
            // This will resolve bare imports through Vite's dependency pre-bundling
            const result = await server.transformRequest(virtualId, { ssr: false });
            
            if (result) {
              const contentType = 
                ext === ".js" || ext === ".jsx" ? "application/javascript" :
                ext === ".ts" || ext === ".tsx" ? "application/typescript" :
                "application/javascript";
              
              res.writeHead(200, { 
                "Content-Type": contentType,
                "Cache-Control": "no-cache"
              });
              res.end(result.code);
            } else {
              throw new Error("Transform returned null");
            }
          } catch (error) {
            console.error(`[Plugin Server] Transform error: ${error}`);
            // Fallback: serve file directly (bare imports will fail, but at least file is served)
            const fileContent = readFileSync(pluginPath, "utf-8");
            res.writeHead(200, { 
              "Content-Type": "application/javascript",
              "Cache-Control": "no-cache"
            });
            res.end(fileContent);
          }
        } else {
          // For non-JS files (CSS, JSON, etc.), serve directly
          try {
            const fileContent = readFileSync(pluginPath, "utf-8");
            const contentType = 
              ext === ".json" ? "application/json" :
              ext === ".css" ? "text/css" :
              "text/plain";
            
            res.writeHead(200, { 
              "Content-Type": contentType,
              "Cache-Control": "no-cache"
            });
            res.end(fileContent);
          } catch (error) {
            console.error(`[Plugin Server] Error reading file: ${error}`);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(`Error reading plugin file: ${error}`);
          }
        }
      };
      
      // Insert middleware early, before Vite's default handlers
      server.middlewares.use(pluginMiddleware);
    },
  };
}
