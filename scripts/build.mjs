import * as fs from "node:fs";
import * as esbuild from "esbuild";

const data = fs.readFileSync("data/transcripts.json", "utf8");
fs.writeFileSync("transcripts.js", `export const transcripts = ${data};`);

await Promise.all([
  esbuild.build({
    bundle: true,
    treeShaking: false,
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: true,
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
