import { build, file } from "bun";
import { rmSync, mkdirSync } from "node:fs";

await build({
  entrypoints: ["script.js"],
  outdir: "dist",
  format: "esm",
  target: "browser",
  external: [],
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: false,
  },
  plugins: [
    {
      name: "transcripts",
      setup(build) {
        build.onResolve({ filter: /^(id_map)$/ }, (args) => ({
          path: args.path,
          namespace: "virtual",
        }));

        build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args) => {
          const json = await file("data/id_map.json").json();
          return {
            contents: `export default ${JSON.stringify(json)}`,
            loader: "js",
          };
        });
      },
    },
  ],
});

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
