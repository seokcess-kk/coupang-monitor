import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: [
    "src/background/service-worker.ts",
    "src/content/content-script.ts",
    "src/popup/popup.ts",
  ],
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "chrome120",
  minify: false,
  sourcemap: true,
  entryNames: "[name]",
});

console.log("Extension built successfully");
