import { build } from "bun";
import { file } from "bun";

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
        build.onResolve({ filter: /^transcripts$/ }, () => ({
          path: "transcripts",
          namespace: "virtual",
        }));

        build.onLoad({ filter: /.*/, namespace: "virtual" }, async () => {
          const json = await file("data/transcripts.json").json();

          return {
            contents: `export default ${JSON.stringify(json)}`,
            loader: "js",
          };
        });
      },
    },
  ],
});
