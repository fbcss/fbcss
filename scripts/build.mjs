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
        build.onResolve({ filter: /^(transcripts|id_map)$/ }, (args) => ({
          path: args.path,
          namespace: "virtual",
        }));

        build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args) => {
          const sourceFile = args.path === "transcripts" 
            ? "data/transcripts.json" 
            : "data/id_map.json";
        
          const json = await file(sourceFile).json();
        
          return {
            contents: `export default ${JSON.stringify(json)}`,
            loader: "js",
          };
        });
      },
    },
  ],
});
