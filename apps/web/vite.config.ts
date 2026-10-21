import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coverImages } from "./build/cover-images";

// Keep the original scoped Bootstrap source; trim unused Bootstrap selectors at build time.
// Custom BookGuard CSS after this boundary is preserved verbatim.
function trimBootstrap() {
  async function sources(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(entry => entry.isDirectory()
      ? sources(path.join(directory, entry.name))
      : /\.(ts|tsx)$/.test(entry.name) ? Promise.resolve([path.join(directory, entry.name)]) : Promise.resolve([])));
    return files.flat();
  }
  return {
    name: "bookguard-trim-bootstrap",
    enforce: "pre" as const,
    async transform(source: string, id: string) {
      if (!id.replaceAll("\\", "/").endsWith("/design/legacy-scoped.css")) return;
      const boundary = source.search(/\.legacy-ui \{\r?\n/);
      if (boundary < 0) throw new Error("Scoped Bootstrap boundary missing");
      const files = await sources(fileURLToPath(new URL("./src", import.meta.url)));
      const content = (await Promise.all(files.map(file => readFile(file, "utf8")))).join("\n");
      const used = new Set(content.match(/[a-zA-Z0-9_-]+/g) ?? []);
      for (const token of ["legacy-ui", "active", "show", "fade", "disabled", "collapsing", "was-validated"]) used.add(token);
      const dynamicColors = /^(?:btn|text|bg|border)-(?:primary|secondary|success|danger|warning|info|light|dark)(?:-subtle)?$/;
      const root = postcss.parse(source.slice(0, boundary));
      root.walkRules(rule => {
        const selectors = selectorParser().astSync(rule.selector);
        selectors.each(selector => {
          let keep = true;
          selector.walkClasses(node => {
            if (node.parent?.type === "pseudo" && node.parent.value === ":not") return;
            if (!used.has(node.value) && !dynamicColors.test(node.value)) keep = false;
          });
          if (!keep) selector.remove();
        });
        if (selectors.nodes.length) rule.selector = selectors.toString(); else rule.remove();
      });
      root.walkAtRules(rule => { if (rule.nodes?.length === 0) rule.remove(); });
      return { code: root.toString() + "\n" + source.slice(boundary), map: null };
    }
  };
}

export default defineConfig({
  plugins: [trimBootstrap(), coverImages(), react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    strictPort: true
  },
  build: {
    sourcemap: false,
    outDir: "dist"
  }
});
