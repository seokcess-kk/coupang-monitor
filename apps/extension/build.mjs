import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Copy manifest.json to dist
const manifestSrc = path.join(__dirname, "manifest.json");
const manifestDest = path.join(__dirname, "dist", "manifest.json");
fs.copyFileSync(manifestSrc, manifestDest);

// Copy popup.html to dist
const popupSrc = path.join(__dirname, "src", "popup", "popup.html");
const popupDest = path.join(__dirname, "dist", "popup.html");
fs.copyFileSync(popupSrc, popupDest);

console.log("Extension built successfully");
