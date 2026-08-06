// mini-app/.eslintrc.cjs
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["react", "react-hooks", "@typescript-eslint"],
  settings: { react: { version: "detect" } },
  rules: {
    // Vite + React 17+ используют новый JSX-трансформ, импорт React не нужен
    "react/react-in-jsx-scope": "off",
    // Типизация через TypeScript, а не prop-types
    "react/prop-types": "off",

    // Обязательные deps в хуках (патч App.tsx)
    "react-hooks/exhaustive-deps": "error",

    // Предупреждение на любой inline style (можно понижать до warn)
    "react/forbid-dom-props": [
      "warn",
      {
        forbid: [
          {
            propName: "style",
            message:
              "Избегайте inline styles. Используйте Spacing, Flex или VKUI-токены.",
          },
        ],
      },
    ],

    // Жёсткий бан на margin/padding/display:flex в inline-стилях
    "no-restricted-syntax": [
      "error",
      {
        selector:
          'JSXAttribute[name.name="style"] JSXExpressionContainer ObjectExpression Property[key.name=/^(margin|padding)/]',
        message: "Используйте <Spacing> вместо inline margin/padding",
      },
      {
        selector:
          'JSXAttribute[name.name="style"] JSXExpressionContainer ObjectExpression Property[key.name="display"][value.value="flex"]',
        message: 'Используйте <Flex> вместо style={{ display: "flex" }}',
      },
    ],
  },
  overrides: [
    // Разрешаем style в служебных файлах
    {
      files: ["*.config.*", "*.d.ts", "**/styles/**/*"],
      rules: { "react/forbid-dom-props": "off", "no-restricted-syntax": "off" },
    },
  ],
};
