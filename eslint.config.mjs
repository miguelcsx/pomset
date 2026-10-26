// Flat ESLint configuration for the whole workspace. Type-aware linting is
// deliberately not enabled: the type checker already runs in CI (`tsc -b`) and
// the boundary rule that matters is enforced by scripts/check-boundaries.mjs.
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.venv/**",
      "**/generated/**",
      "inspo/**",
      "dont-track/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { URL: "readonly", console: "readonly", process: "readonly" },
    },
  },
);
