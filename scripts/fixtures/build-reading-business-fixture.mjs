import { resolve } from "node:path";

const outdir = process.argv[2];
if (!outdir) throw new Error("READING_FIXTURE_OUTDIR_REQUIRED");

const result = await Bun.build({
  entrypoints: ["scripts/fixtures/reading-business-entry.tsx"],
  outdir,
  target: "browser",
  minify: true,
  external: ["/ai-deep-reading/*", "/performance/*", "/ritual/*", "/free-reading/*"],
  plugins: [{
    name: "reading-fixture-next-image",
    setup(builder) {
      builder.onResolve({ filter: /^next\/image$/ }, () => ({
        path: resolve("scripts/fixtures/next-image-stub.mjs"),
      }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
        path: resolve("scripts/fixtures/next-navigation-stub.mjs"),
      }));
    },
  }],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
