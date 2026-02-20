import path from "node:path";
import fs from "node:fs";
import fg from "fast-glob";
import { build, createServer, type InlineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";
import inject from "@rollup/plugin-inject";
import type { MixGraph } from "./index.js";

function relKeyFromResources(file: string) {
  return file
    .replace(/^resources\/assets\/(js|css|sass)\//, "")
    .replace(/\.(js|css|scss|sass)$/, "");
}

function ensurePosix(p: string) {
  return p.split(path.sep).join("/");
}

function translateDefineFromWebpackFn(graph: MixGraph) {
  return graph.define ?? {};
}

function hasFile(p: string) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function hasDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isBareAssetImport(source: string) {
  if (source.startsWith(".") || source.startsWith("/") || source.startsWith("@")) return false;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(source)) return false;
  const sourcePath = source.split("?")[0].split("#")[0];
  if (!sourcePath.includes("/")) return false;
  return /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff|woff2?|eot|ttf|otf)$/i.test(sourcePath);
}

function webpackCompatResolvePlugin() {
  return {
    name: "mix-webpack-compat-resolve",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (!importer) return null;
      const isRelativeOrAbsolute = source.startsWith(".") || source.startsWith("/");

      if (isRelativeOrAbsolute && !path.extname(source)) {
        const importerPath = importer.split("?")[0];
        const baseDir = path.dirname(importerPath);
        const abs = path.resolve(baseDir, source);

        const vueSibling = `${abs}.vue`;
        if (hasFile(vueSibling)) return vueSibling;

        if (hasDir(abs)) {
          const vueIndex = path.join(abs, "index.vue");
          if (hasFile(vueIndex)) return vueIndex;
        }

        // Some legacy imports use "../Board" from ".../Board/CrmActivity/*"
        // while the actual file is ".../Board/index.vue".
        const parentDir = path.dirname(abs);
        if (path.basename(abs) === path.basename(parentDir)) {
          const parentIndexVue = path.join(parentDir, "index.vue");
          if (hasFile(parentIndexVue)) return parentIndexVue;
        }
      }

      if (isBareAssetImport(source)) {
        const sourcePath = source.split("?")[0].split("#")[0];
        const candidates = [path.resolve(process.cwd(), "resources/assets", sourcePath), path.resolve(process.cwd(), "resources", sourcePath)];
        for (const candidate of candidates) {
          if (hasFile(candidate)) return candidate;
        }
      }

      return null;
    },
  };
}

export function viteConfigFromGraph(graph: MixGraph, mode: "development" | "production"): InlineConfig {
  const isProd = mode === "production";

  const input: Record<string, string> = {};

  for (const e of graph.js) {
    input[relKeyFromResources(e.src)] = path.resolve(e.src);
  }
  for (const e of graph.sass) {
    input[relKeyFromResources(e.src)] = path.resolve(e.src);
  }
  for (const e of graph.css) {
    input[relKeyFromResources(e.src)] = path.resolve(e.src);
  }

  const staticTargets: Array<{ src: string; dest: string; rename?: string }> = [];

  for (const c of graph.copies) {
    const normalizedDest = ensurePosix(c.dest).replace(new RegExp(`^${ensurePosix(graph.publicPath)}/?`), "");
    const destDir = path.posix.dirname(normalizedDest);
    const base = path.posix.basename(normalizedDest);

    const hasExt = /\.[a-z0-9]+$/i.test(base);
    staticTargets.push({
      src: ensurePosix(c.src),
      dest: hasExt ? destDir : normalizedDest,
      ...(hasExt ? { rename: base } : {}),
    });
  }

  for (const cd of graph.copyDirs) {
    const normalizedDest = ensurePosix(cd.dest).replace(new RegExp(`^${ensurePosix(graph.publicPath)}/?`), "");
    staticTargets.push({
      src: ensurePosix(cd.src) + "/**/*",
      dest: normalizedDest,
    });
  }

  const wantsJquery =
    Object.values(graph.autoload).some((arr) => arr.includes("$") || arr.includes("jQuery") || arr.includes("window.jQuery")) ||
    Object.keys(graph.autoload).some((k) => k.toLowerCase() === "jquery");

  const plugins: any[] = [webpackCompatResolvePlugin()];

  const wantsVue3 = graph.js.some((e) => e.vue?.version === 3);
  if (wantsVue3) plugins.push(vue());

  if (wantsJquery) {
    plugins.push({
      ...inject({
        $: "jquery",
        jQuery: "jquery",
        "window.jQuery": "jquery",
      }),
      enforce: "post",
    });
  }

  if (staticTargets.length) {
    plugins.push(
      viteStaticCopy({
        targets: staticTargets as any,
      })
    );
  }

  return {
    resolve: {
      // Match legacy webpack resolution so imports like "../Board" can resolve "../Board.vue".
      extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json", ".vue"],
      alias: [
        // Webpack-era Sass imports often use "~pkg/path" for node_modules.
        // Vite doesn't require "~", so strip it for compatibility.
        { find: /^~(.*)$/, replacement: "$1" },
      ],
    },
    plugins,
    define: translateDefineFromWebpackFn(graph),
    build: {
      manifest: true,
      outDir: graph.publicPath,
      emptyOutDir: false,
      assetsDir: "",
      rollupOptions: {
        input,
        output: isProd
          ? {
              entryFileNames: `js/[name]-[hash].js`,
              assetFileNames: (assetInfo) => {
                const name = assetInfo.name || "";
                if (name.endsWith(".css")) return `css/[name]-[hash][extname]`;
                return `assets/[name]-[hash][extname]`;
              },
            }
          : {
              entryFileNames: `js/[name].js`,
              assetFileNames: (assetInfo) => {
                const name = assetInfo.name || "";
                if (name.endsWith(".css")) return `css/${name}`;
                return `assets/${name}`;
              },
            },
      },
    },
    server: {
      strictPort: true,
    },
  };
}

export async function runViteBuild(graph: MixGraph) {
  await build(viteConfigFromGraph(graph, "production"));
}

export async function runViteDev(graph: MixGraph) {
  const server = await createServer(viteConfigFromGraph(graph, "development"));
  await server.listen();
  server.printUrls();
}
