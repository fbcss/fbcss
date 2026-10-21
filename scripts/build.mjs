import { file } from "bun";
import { rmSync, mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { minify } from "html-minifier-terser";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const idMapPlugin = {
  name: "id_map",
  setup(build) {
    build.onResolve({ filter: /^id_map$/ }, (args) => ({
      path: args.path,
      namespace: "virtual",
    }));

    build.onLoad({ filter: /.*/, namespace: "virtual" }, async () => {
      const json = await Bun.file("data/id_map.json").json();
      return {
        contents: `export default ${JSON.stringify(json)}`,
        loader: "js",
      };
    });
  },
};

const cache = new Map();
function bundle(path) {
  if (!cache.has(path)) {
    cache.set(path, (async () => {
      const r = await Bun.build({
        entrypoints: [join("src", path.replace(/^\//, ""))],
        format: "esm",
        target: "browser",
        minify: { whitespace: true, syntax: true, identifiers: false },
        external: ["./assets/*"],
        plugins: [idMapPlugin],
      });
      if (!r.success) { console.error(r.logs); process.exit(1); }
      return r.outputs[0].text();
    })());
  }
  return cache.get(path);
}

async function replaceAsync(str, re, fn) {
  const parts = []; let last = 0;
  for (const m of str.matchAll(re)) {
    parts.push(str.slice(last, m.index), fn(m));
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return (await Promise.all(parts)).join("");
}

const safe = (code, tag) => code.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");

async function buildHtml(file) {
  let html = await Bun.file(join("src", file)).text();

  html = await replaceAsync(html, /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/g,
    async (m) => `<script type="module">${safe(await bundle(m[1]), "script")}</script>`);

  html = await replaceAsync(html, /<link\b[^>]*>/g, async (m) => {
    if (!/rel=["']stylesheet["']/.test(m[0])) return m[0];
    const href = m[0].match(/href=["']([^"']+)["']/)?.[1];
    return href ? `<style>${safe(await bundle(href), "style")}</style>` : m[0];
  });

  html = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: false,
    minifyCSS: false,
  });
  await Bun.write(join("dist", file), html);
}

await Promise.all(readdirSync("src").filter((f) => f.endsWith(".html")).map(buildHtml));

if (existsSync(join("src", "assets"))) cpSync(join("src", "assets"), join("dist", "assets"), { recursive: true });

if (existsSync(join("src", "manifest.json"))) {
  await Bun.write(join("dist", "manifest.json"), JSON.stringify(await Bun.file(join("src", "manifest.json")).json()));
}

// Chunk transcript data into several concurrently fetchable files
const MAX_BYTES = 2_500_000;
const OUT = "dist/data";

const data = await file("data/transcripts.json").json();
const bytes = new TextEncoder().encode(JSON.stringify(data));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let i = 0, n = 0;
while (i < bytes.length) {
  let j = Math.min(i + MAX_BYTES, bytes.length);
  while (j < bytes.length && (bytes[j] & 0xc0) === 0x80) j--;
  await Bun.write(`${OUT}/chunk-${n++}.txt`, bytes.subarray(i, j));
  i = j;
}

await Bun.write(
  `${OUT}/manifest.json`,
  JSON.stringify({ v: Bun.hash(bytes).toString(36), chunks: n })
);
