import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const typeScale = new Map([
  ["11", "2xs"], ["11.5", "2xs"], ["12", "xs"], ["12.5", "sm"],
  ["13", "sm"], ["13.5", "sm"], ["14", "sm"], ["15", "md"],
  ["17", "lg"], ["18", "lg"], ["22", "xl"], ["24", "2xl"], ["26", "2xl"],
]);

const bowerRules = {
  rules: {
    "named-type-scale": {
      meta: { type: "suggestion", fixable: "code", schema: [], messages: { named: "Use the named Bower type scale instead of arbitrary pixel text sizes." } },
      create(context) {
        const check = (node, value) => {
          const replaced = value.replace(/text-\[([\d.]+)px\]/g, (match, pixels) => `text-${typeScale.get(pixels) ?? "sm"}`);
          if (replaced !== value) context.report({ node, messageId: "named", fix: (fixer) => fixer.replaceText(node, JSON.stringify(replaced)) });
        };
        return {
          Literal(node) { if (typeof node.value === "string") check(node, node.value); },
          TemplateElement(node) {
            const value = context.sourceCode.getText(node);
            const replaced = value.replace(/text-\[([\d.]+)px\]/g, (match, pixels) => `text-${typeScale.get(pixels) ?? "sm"}`);
            if (replaced !== value) context.report({ node, messageId: "named", fix: (fixer) => fixer.replaceText(node, replaced) });
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { bower: bowerRules },
    rules: { "bower/named-type-scale": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
