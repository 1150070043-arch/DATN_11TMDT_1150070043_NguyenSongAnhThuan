import type { Plugin } from "vite";
import sharp from "sharp";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const virtualId = "virtual:bookguard-cover-manifest";
const resolvedId = `\0${virtualId}`;

// Original covers stay untouched. Build variants become hashed Vite assets;
// the dev server serves the same variants without writing generated files.
export function coverImages(): Plugin {
  const directory = fileURLToPath(new URL("../public/design/covers/", import.meta.url));
  type Variant = { original: string; name: string; width: number; height: number; data: Buffer };
  let prepared: Promise<Variant[]> | undefined;
  function prepare(): Promise<Variant[]> {
    return prepared ??= (async () => {
      const variants: Variant[] = [];
      for (const name of (await readdir(directory)).filter(name => /^\d+-L\.jpg$/.test(name)).sort()) {
        const original = await readFile(`${directory}/${name}`);
        const metadata = await sharp(original).metadata();
        if (!metadata.width) throw new Error(`Cover dimensions unavailable: ${name}`);
        const widths = [...new Set([160, 320, 640].map(width => Math.min(width, metadata.width!)))];
        for (const width of widths) {
          const { data, info } = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer({ resolveWithObject: true });
          variants.push({ original: `/design/covers/${name}`, name: `${name.replace(/-L\.jpg$/, "")}-${info.width}.webp`, width: info.width, height: info.height, data });
        }
      }
      return variants;
    })();
  }
  return {
    name: "bookguard-responsive-covers",
    resolveId(id) { if (id === virtualId) return resolvedId; },
    async load(id) {
      if (id !== resolvedId) return;
      const files = await prepare();
      const entries = [...new Set(files.map(file => file.original))].map(original => {
        const matches = files.filter(file => file.original === original);
        const values = matches.map(file => {
          const url = this.environment?.mode === "build"
            ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: "asset", name: file.name, source: file.data })}`
            : JSON.stringify(`/@bookguard-covers/${file.name}`);
          return `{url:${url},width:${file.width},height:${file.height}}`;
        });
        return `${JSON.stringify(original)}:[${values.join(",")}]`;
      });
      return `export default {${entries.join(",")}};`;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/@bookguard-covers/")) return next();
        try {
          const file = (await prepare()).find(file => `/@bookguard-covers/${file.name}` === req.url?.split("?")[0]);
          if (!file) { res.statusCode = 404; res.end(); return; }
          res.setHeader("Content-Type", "image/webp");
          res.setHeader("Cache-Control", "no-cache");
          res.end(file.data);
        } catch (error) { next(error); }
      });
    }
  };
}
