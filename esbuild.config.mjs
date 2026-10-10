import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2022",
  platform: "browser",
  logLevel: "info",
  // Dev sourcemap is written next to main.js (main.js.map, git-ignored), not inlined. Owner decision, 2026-10-10.
  sourcemap: prod ? false : "external",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

await context.rebuild();
process.exit(0);
