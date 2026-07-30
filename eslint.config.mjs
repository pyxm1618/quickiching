import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import { fileURLToPath } from "node:url";
import path from "node:path";

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory,
  recommendedConfig: js.configs.recommended,
});
const nextCoreWebVitals = compat.extends("next/core-web-vitals");

const config = [
  {
    ignores: [".next/**", "node_modules/**", "phototype/**"],
  },
  ...nextCoreWebVitals,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
    },
  },
];

export default config;
