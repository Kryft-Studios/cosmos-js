/*import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  js.configs.recommended,

  {
    languageOptions: {
      globals: globals.browser,
    },
  },

  tseslint.configs.recommended,
  {
    files: ["*.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-useless-vars": "warn",
      "@typescript-eslint/naming-convention": [
        "error",

        { selector: "function", format: ["camelCase"] },
        { selector: "parameter", format: ["camelCase"] },
        { selector: "class", format: ["PascalCase"] },
        { selector: "interface", format: ["UPPER_CASE"] },

        { selector: "typeAlias", format: ["UPPER_CASE"] },

        { selector: "enum", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase"] },
      ],
    },
  },
]);*/