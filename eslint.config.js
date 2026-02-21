import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // This repo intentionally uses flexible typing in many places (Supabase JSON, dynamic forms, etc.)
      "@typescript-eslint/no-explicit-any": "off",
      // shadcn/ui uses empty interface patterns in a few components
      "@typescript-eslint/no-empty-object-type": "off",
      // Tailwind config commonly uses require() for plugins
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
