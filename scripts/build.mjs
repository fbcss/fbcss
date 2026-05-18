import * as fs from "node:fs";
import * as esbuild from "esbuild";

const data = await fetch(
  "https://raw.githubusercontent.com/fbcss/fbcss/main/data/transcripts.json",
).then((r) => r.json());
fs.writeFileSync("transcripts.js", `export const transcripts = ${JSON.stringify(data)};`);

await Promise.all([
  esbuild.build({
    bundle: true,
    minify: true,
    entryPoints: ["script.js"],
    outfile: "dist/bundle.js",
  }),
  esbuild.build({
    entryPoints: ["styles.css"],
    bundle: true,
    minify: true,
    outfile: "dist/styles.css",
    loader: {
      ".ttf": "dataurl",
      ".otf": "dataurl",
    },
  }),
]);

fs.unlinkSync("transcripts.js");
