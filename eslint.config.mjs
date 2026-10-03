import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { readFileSync } from "node:fs";

const theme = readFileSync(new URL("./src/app/globals.css", import.meta.url), "utf8").match(/@theme[^\{]*\{([^}]+)\}/)[1];
const colors = new Set([...theme.matchAll(/--color-([\w-]+):/g)].map((match) => match[1]));
const nonColors = new Set([
  "white", "black", "transparent", "current", "inherit", "none", "auto",
  "left", "right", "center", "justify", "start", "end", "wrap", "nowrap", "balance", "pretty",
  "ellipsis", "clip", "solid", "dashed", "dotted", "double", "hidden", "collapse", "separate",
  "inset", "offset", "t", "r", "b", "l", "x", "y", "s", "e", "px",
  ...[...theme.matchAll(/--(?:text|shadow)-([\w-]+):/g)].map((match) => match[1]),
]);

const typeScale = new Map([
  ["11", "2xs"], ["11.5", "2xs"], ["12", "xs"], ["12.5", "sm"],
  ["13", "sm"], ["13.5", "sm"], ["14", "sm"], ["15", "md"],
  ["17", "lg"], ["18", "lg"], ["22", "xl"], ["24", "2xl"], ["26", "2xl"],
]);

const bowerRules = {
  rules: {
    "named-type-scale": {
      meta: { type: "suggestion", fixable: "code", schema: [], messages: { named: "Use the named Bower type scale instead of arbitrary pixel text sizes.", color: "Unknown color utility '{{utility}}'; use a color declared in @theme." } },
      create(context) {
        const checkColors = (node, value) => {
          for (const match of value.matchAll(/(?:^|[\s:'"`])((?:bg|text|border|ring|outline|fill|stroke|divide|from|via|to|shadow|decoration|placeholder|caret|accent)-(?:offset-)?([a-z][\w-]*))/g)) {
            const [, utility, rawToken] = match;
            const token = rawToken.replace(/^(?:[trblxyse]|offset)-/, "");
            if (!colors.has(token) && !nonColors.has(token) && !/^\d+(?:\.\d+)?$/.test(token) && !/^(?:gradient-|linear-|radial|conic)/.test(token)) {
              context.report({ node, messageId: "color", data: { utility } });
            }
          }
        };
        const check = (node, value) => {
          checkColors(node, value);
          const replaced = value.replace(/text-\[([\d.]+)px\]/g, (match, pixels) => `text-${typeScale.get(pixels) ?? "sm"}`);
          if (replaced !== value) context.report({ node, messageId: "named", fix: (fixer) => fixer.replaceText(node, JSON.stringify(replaced)) });
        };
        return {
          Literal(node) { if (typeof node.value === "string") check(node, node.value); },
          TemplateElement(node) {
            const value = context.sourceCode.getText(node);
            checkColors(node, value);
            const replaced = value.replace(/text-\[([\d.]+)px\]/g, (match, pixels) => `text-${typeScale.get(pixels) ?? "sm"}`);
            if (replaced !== value) context.report({ node, messageId: "named", fix: (fixer) => fixer.replaceText(node, replaced) });
          },
        };
      },
    },
    "no-low-contrast-focus": {
      meta: { type: "problem", schema: [], messages: { contrast: "Use brand-500 for button focus, or the complete 3px brand-100 ring and brand-500 border for form controls." } },
      create(context) {
        const check = (node, value) => {
          const controlFocus = value.includes('focus-visible:ring-[3px]') && value.includes('focus-visible:ring-brand-100') && value.includes('focus-visible:border-brand-500');
          if (!controlFocus && /ring-brand-(?:100|300)|focus(?:-visible)?:border-brand-300/.test(value)) context.report({ node, messageId: "contrast" });
        };
        return {
          Literal(node) { if (typeof node.value === "string") check(node, node.value); },
          TemplateElement(node) { check(node, context.sourceCode.getText(node)); },
        };
      },
    },
    "no-faint-text": {
      meta: { type: "problem", schema: [], messages: { faint: "Do not use text-ink-faint for text; reserve it for decorative icons and non-text wrappers." } },
      create(context) {
        const textElements = new Set(["a", "button", "caption", "code", "dd", "dt", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6", "label", "li", "option", "p", "span", "td", "th"]);
        const classValue = (attribute) => {
          if (!attribute?.value) return "";
          if (attribute.value.type === "Literal") return String(attribute.value.value ?? "");
          const expression = attribute.value.expression;
          return expression?.type === "Literal" ? String(expression.value ?? "") : "";
        };
        const isText = (child) => {
          if (child.type === "JSXText") return child.value.trim().length > 0;
          if (child.type !== "JSXExpressionContainer" || child.expression.type === "JSXEmptyExpression") return false;
          if (child.expression.type === "JSXElement" || child.expression.type === "JSXFragment") return false;
          return !(child.expression.type === "Identifier" && /icon/i.test(child.expression.name));
        };
        return {
          JSXElement(node) {
            const opening = node.openingElement;
            if (opening.name.type !== "JSXIdentifier" || !textElements.has(opening.name.name)) return;
            const hidden = opening.attributes.some((attribute) => attribute.type === "JSXAttribute" && attribute.name.name === "aria-hidden");
            if (hidden || !node.children.some(isText)) return;
            const className = opening.attributes.find((attribute) => attribute.type === "JSXAttribute" && attribute.name.name === "className");
            if (/\btext-ink-faint\b/.test(classValue(className))) context.report({ node: className, messageId: "faint" });
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
    rules: { "bower/named-type-scale": "error", "bower/no-low-contrast-focus": "error", "bower/no-faint-text": "error" },
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
