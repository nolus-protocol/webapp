/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  env: {
    node: true,
  },
  globals: {
    NodeJS: true,
  },
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "@vue/eslint-config-typescript",
    "@vue/eslint-config-prettier",
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "vue/multi-word-component-names": "off",
    "no-unused-vars": "off",
    "no-unused-expressions": "off",
    "no-useless-escape": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "vue/no-mutating-props": "off",
    "prettier/prettier": "off",
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
  },
  ignorePatterns: ["modules/*.js"],
};
